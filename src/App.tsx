import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LuCalendarDays, LuChartColumn, LuChartPie, LuEye, LuEyeOff, LuLock, LuPlus, LuSettings, LuTarget, LuWallet } from 'react-icons/lu';
import type { ForecastItem, PendingItem, ScenarioItem, Tx } from './engine';
import { computeMonth, envelopeShortfall, fmt, lockCheck, monthKey, setMaskAmounts, toCSV, toISODate } from './engine';
import { PaySheet, usualWallet, type PayTarget } from './sheets/PaySheet';
import { FundSheet, PlanSheet, type FundTarget } from './sheets/Envelope';
import { LockScreen, PrivacySettings, useAppLock, useCodePrompt } from './sheets/Lock';
import { resetReveals, setSecurity, useSecurity, type LockArea } from './services/security';
import { download, useBudgetStore, useUiPrefs } from './store';
import { APP, Logo } from './config';
import { HEALTH, Toast, cx } from './ui';
import { BudgetScreen } from './screens/Budget';
import { GoalsScreen } from './screens/Goals';
import { ContributeSheet, DebtSheet, GoalSheet, GroupsSheet, PayDebtSheet, UnlockSheet } from './sheets/GoalSheets';
import { CalendarScreen } from './screens/Calendar';
import { MoneyScreen } from './screens/Money';
import { AnalysisScreen } from './screens/Analysis';
import { AddSheet, type AddMode } from './sheets/AddSheet';
import { Welcome } from './sheets/Welcome';
import { AccountSheet, STATUS_LABEL, SyncIcon } from './sheets/Account';
import { useAccount } from './services/account';
import { applyNativeReminders, onExpenseAction } from './services/reminders';
import { isNative } from './services/native';
import { initBackButton, setRootBack } from './services/back';
import { CategorySheet, EditTxSheet, RebalanceSheet, SettingsSheet, WalletSheet } from './sheets/Sheets';

type Tab = 'money' | 'goals' | 'calendar' | 'budget' | 'analysis';
const TAB_LABEL: Record<Tab, string> = { money: 'Patrimoine', goals: 'Objectifs', calendar: 'Activité', budget: 'Budget', analysis: 'Stats' };

export default function App() {
  const store = useBudgetStore();
  const [ui, setUi] = useUiPrefs();
  const account = useAccount(store);
  const [accountOpen, setAccountOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('budget');
  const [anaTab, setAnaTab] = useState<'stats' | 'sim'>('stats');
  const [now, setNow] = useState(() => new Date());
  const [month, setMonth] = useState(() => monthKey(new Date()));

  const [add, setAdd] = useState<{ mode: AddMode; date?: string; scan?: boolean; amount?: number; categoryId?: string } | null>(null);
  const [editTx, setEditTx] = useState<Tx | null>(null);
  const [catId, setCatId] = useState<string | null>(null);
  const [walletId, setWalletId] = useState<string | null>(null);
  const [rebalance, setRebalance] = useState(false);
  const [settings, setSettings] = useState(false);
  const [goalId, setGoalId] = useState<string | null>(null);
  const [contribId, setContribId] = useState<string | null>(null);
  const [debtId, setDebtId] = useState<string | null>(null);
  const [payId, setPayId] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ids?: string[] } | null>(null);
  const [pay, setPay] = useState<PayTarget | null>(null);
  const [unlockId, setUnlockId] = useState<string | null>(null);
  const [fund, setFund] = useState<FundTarget | null>(null);
  const [planDate, setPlanDate] = useState<string | null>(null);

  // Confidentialité : montants masqués, code, onglets protégés.
  const sec = useSecurity();
  const { element: codePrompt, requireCode } = useCodePrompt();
  const appLock = useAppLock();
  const [openAreas, setOpenAreas] = useState<Set<string>>(() => new Set());
  useEffect(() => { if (appLock.locked) setOpenAreas(new Set()); }, [appLock.locked]);
  const tabLocked = !!sec.pin && (sec.areas ?? []).includes(tab as LockArea) && !openAreas.has(tab);
  // Onglet protégé : il reste affiché, seuls les montants sont masqués jusqu'au code.
  setMaskAmounts(!!sec.mask || tabLocked);
  useEffect(() => { if (appLock.locked) resetReveals(); }, [appLock.locked]);
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'hidden') resetReveals(); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  const unlockTab = async (t: Tab) => {
    if (await requireCode(`Ouvrir « ${TAB_LABEL[t]} »`)) setOpenAreas((s) => new Set(s).add(t));
  };
  const toggleMask = async () => {
    if (!sec.mask) { setSecurity({ mask: true }); setToast({ msg: 'Montants masqués' }); return; }
    if (await requireCode('Afficher les montants')) setSecurity({ mask: false });
  };
  const onPayItem = (p: PendingItem) => (p.kind === 'goal' ? setContribId(p.refId) : setPay({ categoryId: p.refId, date: p.date, amount: p.amount, key: p.key, walletId: p.walletId }));
  const openUnlock = (goalId: string) => { go('goals'); setUnlockId(goalId); };

  // « Oui, dépensé » en un geste : montant prévu, compte habituel. S'il y a un souci (argent bloqué,
  // enveloppe insuffisante), on ouvre la fiche pour choisir.
  const quickPay = (t: PayTarget) => {
    const st = storeRef.current.state;
    const date = t.date < toISODate(new Date()) ? t.date : toISODate(new Date());
    const wallet = t.walletId ?? st.categories.find((c) => c.id === t.categoryId)?.sourceWalletId ?? usualWallet(storeRef.current, t.categoryId);
    if (lockCheck(st, wallet, t.amount) || envelopeShortfall(st, t.categoryId, t.amount, date.slice(0, 7))) { setPay({ ...t, walletId: wallet }); return; }
    const name = t.note || st.categories.find((c) => c.id === t.categoryId)?.name || 'Dépense';
    const id = storeRef.current.addTx({ type: 'expense', amount: t.amount, date, categoryId: t.categoryId, walletId: wallet, note: t.note, planKey: t.key });
    setToast({ msg: `${name} : ${fmt(t.amount)} XOF dépensé ✓`, ids: [id] });
  };
  const skipKey = (key: string, name: string) => {
    storeRef.current.setAll((s) => ({ ...s, skipped: [...new Set([...(s.skipped ?? []), key])].slice(-2000) }));
    setToast({ msg: `${name} : non dépensé aujourd’hui` });
  };
  const onForecast = (action: 'yes' | 'no' | 'other' | 'undo', f: ForecastItem) => {
    const t: PayTarget = { categoryId: f.categoryId, date: toISODate(now), amount: Math.max(0, f.planned - f.spent), key: f.key, walletId: f.walletId, note: f.note };
    if (action === 'yes') quickPay(t);
    else if (action === 'no') skipKey(f.key, f.name);
    else if (action === 'other') setPay(t);
    else store.setAll((s) => ({ ...s, skipped: (s.skipped ?? []).filter((k) => k !== f.key) }));
  };
  const storeRef = useRef(store);
  storeRef.current = store;
  // Réponses données depuis les notifications (Oui / Non / Autre montant).
  useEffect(() => onExpenseAction((a) => {
    const t: PayTarget = { categoryId: a.categoryId, date: a.date, amount: a.amount, key: a.key, walletId: a.walletId, note: a.note };
    const name = a.note || storeRef.current.state.categories.find((c) => c.id === a.categoryId)?.name || 'Dépense';
    if (storeRef.current.state.txs.some((x) => x.planKey === a.key)) return; // déjà confirmé
    if (a.action === 'oui') quickPay(t);
    else if (a.action === 'non') skipKey(a.key, name);
    else { setTab('budget'); setPay(t); }
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  // Rafraîchit la date au retour sur l'app (changement de jour / de mois).
  useEffect(() => {
    const h = () => { if (document.visibilityState === 'visible') setNow(new Date()); };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  const r = useMemo(() => computeMonth(store.state, month, now), [store.state, month, now]);

  // Rappels du téléphone (APK) : reprogrammés après chaque changement, au calme.
  useEffect(() => {
    if (!isNative()) return;
    const t = setTimeout(() => { applyNativeReminders(store.state).catch(() => {}); }, 3000);
    return () => clearTimeout(t);
  }, [store.state]);
  const h = HEALTH[r.health];
  const isCurrent = month === monthKey(now);
  const [y, m] = month.split('-').map(Number);
  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  const onSaved = useCallback((msg: string, ids: string[]) => { setAdd(null); setToast({ msg, ids }); }, []);

  const applyScenario = (items: ScenarioItem[]) => {
    const date = toISODate(new Date());
    for (const it of items) {
      if (it.kind === 'expense') store.addTx({ type: 'expense', amount: it.amount, date, categoryId: it.categoryId, walletId: it.walletId ?? 'w_cash', note: it.label });
      else if (it.kind === 'income') store.addTx({ type: 'income', amount: it.amount, date, categoryId: 'i_bonus', walletId: it.walletId ?? 'w_bank', note: it.label });
      else if (it.kind === 'transfer') store.addTx({ type: 'transfer', amount: it.amount, date, fromWalletId: it.fromWalletId, toWalletId: it.toWalletId, note: it.label });
      else if (it.kind === 'cut') {
        const c = store.state.categories.find((x) => x.id === it.categoryId);
        if (c && c.kind !== 'obligatory') store.updateCategory(c.id, { budget: Math.max(0, c.budget - it.amount) });
      }
    }
    setToast({ msg: 'Scénario appliqué à tes données réelles' });
    setAnaTab('stats');
  };

  // Retour du téléphone : fenêtre ouverte → fermée ; sinon onglet précédent ; à la racine, second appui pour quitter.
  const tabHistory = useRef<Tab[]>([]);
  const go = (t: Tab) => {
    if (t !== tab) tabHistory.current = [...tabHistory.current.filter((x) => x !== t), tab].slice(-8);
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const backState = useRef({ tab, anaTab });
  backState.current = { tab, anaTab };
  useEffect(() => {
    setRootBack(() => {
      const { tab: cur, anaTab: sub } = backState.current;
      if (cur === 'analysis' && sub === 'sim') { setAnaTab('stats'); return true; }
      const prev = tabHistory.current.pop();
      if (prev && prev !== cur) { setTab(prev); window.scrollTo({ top: 0 }); return true; }
      if (cur !== 'budget') { setTab('budget'); return true; }
      return false;
    });
    initBackButton(() => setToast({ msg: 'Appuie encore sur Retour pour quitter' }));
  }, []);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-md flex-col">
      {/* EN-TÊTE */}
      <header className="safe-top glass sticky top-0 z-30 px-4 pb-1.5 pt-2.5" style={{ background: 'color-mix(in srgb, var(--s-bg) 88%, transparent)' }}>
        <div className="flex items-center gap-2.5">
          <Logo size={34} />
          <div className="min-w-0 flex-1">
            <div className="truncate whitespace-nowrap text-[15px] font-extrabold leading-tight text-primary">{APP.name}</div>
            <div className="flex items-center gap-1.5 whitespace-nowrap text-[11.5px] capitalize leading-tight text-muted">
              {monthLabel}
              {!isCurrent && (
                <button onClick={() => setMonth(monthKey(now))} className="rounded-md bg-surface2 px-1.5 font-semibold normal-case text-primary">aujourd’hui</button>
              )}
            </div>
          </div>
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold max-[350px]:hidden" style={{ background: h.soft, color: h.color }} title={r.healthReasons.join(' ')}>
            <span className="h-2 w-2 rounded-full" style={{ background: h.color }} /><span className="max-[400px]:hidden">{h.label}</span>
          </span>
          <button onClick={toggleMask} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2" aria-label={sec.mask ? 'Afficher les montants' : 'Masquer les montants'} title={sec.mask ? 'Afficher les montants' : 'Masquer les montants'}>
            {sec.mask ? <LuEyeOff size={18} /> : <LuEye size={18} />}
          </button>
          <button onClick={() => setAccountOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2" aria-label={`Compte : ${STATUS_LABEL[account.status]}`} title={STATUS_LABEL[account.status]}>
            <SyncIcon status={account.status} />
          </button>
          <button onClick={() => setSettings(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2" aria-label="Réglages"><LuSettings size={18} /></button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-1" key={tab}>
        <div className="anim-fade">
          {tabLocked && (
            <button onClick={() => unlockTab(tab)} className="mb-2 flex w-full items-center gap-2 rounded-2xl bg-surface2 px-3 py-2.5 text-left text-[12.5px]">
              <LuLock className="shrink-0 text-primary" size={16} />
              <span className="min-w-0 flex-1">Montants masqués dans « {TAB_LABEL[tab]} »</span>
              <span className="shrink-0 rounded-lg bg-primary px-2.5 py-1 text-[12px] font-bold text-onprimary">Afficher</span>
            </button>
          )}
          {tab === 'budget' && (
            <BudgetScreen
              state={store.state} r={r} month={month} setMonth={setMonth}
              onRebalance={() => setRebalance(true)}
              onCategory={setCatId}
              onNewCategory={() => setCatId('')}
              onGroups={() => setGroupsOpen(true)}
              onSimulate={() => { setAnaTab('sim'); go('analysis'); }}
              onPay={onPayItem}
              onFund={(id) => setFund({ categoryId: id || undefined })}
              onForecast={onForecast}
              onEditTx={(id) => setEditTx(store.state.txs.find((x) => x.id === id) ?? null)}
              today={now}
            />
          )}
          {tab === 'goals' && (
            <GoalsScreen
              state={store.state} r={r}
              onNewGoal={() => setGoalId('')} onEditGoal={setGoalId} onContribute={setContribId} onUnlock={setUnlockId}
              onNewDebt={() => setDebtId('')} onEditDebt={setDebtId} onPayDebt={setPayId}
            />
          )}
          {tab === 'calendar' && (
            <CalendarScreen state={store.state} r={r} month={month} setMonth={setMonth} onEdit={setEditTx} onAdd={(date) => setAdd({ mode: 'expense', date })} onPay={setPay}
              onPlan={setPlanDate} onFund={(date) => setFund({ date })}
              onRemovePlanned={(id) => store.setAll((s) => ({ ...s, planned: (s.planned ?? []).filter((p) => p.id !== id) }))} />
          )}
          {tab === 'money' && (
            <MoneyScreen state={store.state} r={r} onTransfer={() => setAdd({ mode: 'transfer' })} onEditWallet={setWalletId} onAddWallet={() => setWalletId('')} onEdit={setEditTx} requireCode={requireCode} />
          )}
          {tab === 'analysis' && (
            <AnalysisScreen
              state={store.state} r={r} today={now} tab={anaTab} setTab={setAnaTab}
              onCategory={setCatId}
              onExport={() => download(`budget-ivoire-${toISODate(new Date())}.csv`, toCSV(store.state), 'text/csv;charset=utf-8')}
              onApplyScenario={applyScenario}
            />
          )}
        </div>
      </main>

      {/* BOUTON AJOUT RAPIDE */}
      <button
        onClick={() => setAdd({ mode: 'expense' })}
        className="fixed bottom-[86px] z-40 grid h-14 w-14 place-items-center rounded-full text-onprimary shadow-lg transition active:scale-95"
        style={{ right: 'max(16px, calc(50% - 208px))', background: 'var(--s-primary)', boxShadow: '0 10px 22px -8px var(--s-primary)' }}
        aria-label="Ajouter une dépense"
      >
        <LuPlus size={28} strokeWidth={2.6} />
      </button>

      {/* NAVIGATION : 5 onglets */}
      <nav className="safe-bottom glass fixed inset-x-0 bottom-0 z-40 border-t border-line" style={{ background: 'var(--s-nav)' }}>
        <div className="mx-auto grid max-w-md grid-cols-5 px-1 pt-1.5">
          <NavBtn on={tab === 'money'} icon={<LuWallet size={21} />} label="Patrimoine" onClick={() => go('money')} />
          <NavBtn on={tab === 'goals'} icon={<LuTarget size={21} />} label="Objectifs" onClick={() => go('goals')} />
          <NavBtn on={tab === 'calendar'} icon={<LuCalendarDays size={21} />} label="Activité" onClick={() => go('calendar')} />
          <NavBtn on={tab === 'budget'} icon={<LuChartPie size={21} />} label="Budget" onClick={() => go('budget')} />
          <NavBtn on={tab === 'analysis'} icon={<LuChartColumn size={21} />} label="Stats" onClick={() => go('analysis')} />
        </div>
      </nav>

      <AddSheet open={!!add} onClose={() => setAdd(null)} store={store} initialMode={add?.mode} initialDate={add?.date} autoScan={add?.scan} initialAmount={add?.amount} initialCategory={add?.categoryId} onSaved={onSaved} onUnlock={openUnlock} />
      <EditTxSheet tx={editTx} onClose={() => setEditTx(null)} store={store} />
      <CategorySheet id={catId} onClose={() => setCatId(null)} store={store} onFund={(id) => setFund({ categoryId: id })} onLog={(id) => setAdd({ mode: 'expense', categoryId: id })} />
      <FundSheet target={fund} onClose={() => setFund(null)} store={store} onDone={(m) => { setFund(null); setToast({ msg: m }); }} />
      <PlanSheet date={planDate} onClose={() => setPlanDate(null)} store={store} onDone={(m) => { setPlanDate(null); setToast({ msg: m }); }} />
      <WalletSheet id={walletId} onClose={() => setWalletId(null)} store={store} />
      <RebalanceSheet open={rebalance} onClose={() => setRebalance(false)} store={store} r={r} onDone={(m) => { setRebalance(false); setToast({ msg: m }); }} />
      <GoalSheet id={goalId} onClose={() => setGoalId(null)} store={store} />
      <ContributeSheet id={contribId} onClose={() => setContribId(null)} store={store} onDone={(m) => { setContribId(null); setToast({ msg: m }); }} onUnlock={openUnlock} />
      <UnlockSheet id={unlockId} onClose={() => setUnlockId(null)} store={store} onDone={(m) => { setUnlockId(null); setToast({ msg: m }); }}
        requireCode={(r) => (sec.lockProjects ? requireCode(r) : Promise.resolve(true))} />
      <PaySheet target={pay} onClose={() => setPay(null)} store={store} onDone={(m, ids) => { setPay(null); setToast({ msg: m, ids: ids.length ? ids : undefined }); }} onUnlock={openUnlock} />
      <DebtSheet id={debtId} onClose={() => setDebtId(null)} store={store} />
      <PayDebtSheet id={payId} onClose={() => setPayId(null)} store={store} onDone={(m) => { setPayId(null); setToast({ msg: m }); }} />
      <GroupsSheet open={groupsOpen} onClose={() => setGroupsOpen(false)} store={store} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} store={store} ui={ui} setUi={setUi} onToast={(m) => setToast({ msg: m })}
        syncLabel={account.session?.token ? `${STATUS_LABEL[account.status]} · ${account.session.email}` : ''} onAccount={() => { setSettings(false); setAccountOpen(true); }}
        privacy={<PrivacySettings requireCode={requireCode} onToast={(m) => setToast({ msg: m })} />} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} account={account}
        onSignedIn={() => { setUi({ ...ui, onboarded: true }); setToast({ msg: 'Connecté ! Tes données sont sauvegardées.' }); }} />

      {!ui.onboarded && !accountOpen && store.state.txs.length === 0 && store.state.settings.expectedIncome === 0 && (
        <Welcome store={store} onLogin={() => setAccountOpen(true)} onDone={() => { setUi({ ...ui, onboarded: true }); setTab('budget'); setToast({ msg: 'Bienvenue ! Ton budget est prêt.' }); }} />
      )}

      {codePrompt}
      {appLock.locked && <LockScreen reason="Ton budget est protégé." onSuccess={appLock.unlock} />}

      {toast && (
        <Toast
          msg={toast.msg}
          action={toast.ids?.length ? 'Annuler' : undefined}
          onAction={() => { toast.ids?.forEach(store.deleteTx); setToast({ msg: 'Annulé' }); }}
        />
      )}
    </div>
  );
}

function NavBtn({ on, icon, label, onClick }: { on: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cx('flex flex-col items-center gap-0.5 py-1 text-[10.5px] font-semibold transition', on ? 'text-primary' : 'text-muted')} aria-current={on ? 'page' : undefined}>
      <span className={cx('grid h-8 w-12 place-items-center rounded-full transition', on && 'bg-primary/12')}>{icon}</span>
      {label}
    </button>
  );
}
