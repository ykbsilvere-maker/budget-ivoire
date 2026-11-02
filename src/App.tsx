import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { LuCalendarDays, LuChartColumn, LuChartPie, LuPlus, LuSettings, LuTarget, LuWallet } from 'react-icons/lu';
import type { ScenarioItem, Tx } from './engine';
import { computeMonth, monthKey, toCSV, toISODate } from './engine';
import { download, useBudgetStore, useUiPrefs } from './store';
import { APP, Logo } from './config';
import { HEALTH, Toast, cx } from './ui';
import { BudgetScreen } from './screens/Budget';
import { GoalsScreen } from './screens/Goals';
import { ContributeSheet, DebtSheet, GoalSheet, GroupsSheet, PayDebtSheet } from './sheets/GoalSheets';
import { CalendarScreen } from './screens/Calendar';
import { MoneyScreen } from './screens/Money';
import { AnalysisScreen } from './screens/Analysis';
import { AddSheet, type AddMode } from './sheets/AddSheet';
import { Welcome } from './sheets/Welcome';
import { AccountSheet, STATUS_LABEL, SyncIcon } from './sheets/Account';
import { useAccount } from './services/account';
import { applyNativeReminders } from './services/reminders';
import { isNative } from './services/native';
import { CategorySheet, EditTxSheet, RebalanceSheet, SettingsSheet, WalletSheet } from './sheets/Sheets';

type Tab = 'money' | 'goals' | 'calendar' | 'budget' | 'analysis';

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

  const go = (t: Tab) => { setTab(t); window.scrollTo({ top: 0 }); };

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
          <span className="flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-1 text-[11px] font-bold" style={{ background: h.soft, color: h.color }} title={r.healthReasons.join(' ')}>
            <span className="h-2 w-2 rounded-full" style={{ background: h.color }} />{h.label}
          </span>
          <button onClick={() => setAccountOpen(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2" aria-label={`Compte : ${STATUS_LABEL[account.status]}`} title={STATUS_LABEL[account.status]}>
            <SyncIcon status={account.status} />
          </button>
          <button onClick={() => setSettings(true)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface2" aria-label="Réglages"><LuSettings size={18} /></button>
        </div>
      </header>

      <main className="flex-1 px-4 pb-32 pt-1" key={tab}>
        <div className="anim-fade">
          {tab === 'budget' && (
            <BudgetScreen
              state={store.state} r={r} month={month} setMonth={setMonth}
              onRebalance={() => setRebalance(true)}
              onCategory={setCatId}
              onNewCategory={() => setCatId('')}
              onGroups={() => setGroupsOpen(true)}
              onSimulate={() => { setAnaTab('sim'); go('analysis'); }}
              onLog={(categoryId, amount) => setAdd({ mode: 'expense', categoryId, amount })}
              today={now}
            />
          )}
          {tab === 'goals' && (
            <GoalsScreen
              state={store.state} r={r}
              onNewGoal={() => setGoalId('')} onEditGoal={setGoalId} onContribute={setContribId}
              onNewDebt={() => setDebtId('')} onEditDebt={setDebtId} onPayDebt={setPayId}
            />
          )}
          {tab === 'calendar' && (
            <CalendarScreen state={store.state} r={r} month={month} setMonth={setMonth} onEdit={setEditTx} onAdd={(date) => setAdd({ mode: 'expense', date })} />
          )}
          {tab === 'money' && (
            <MoneyScreen state={store.state} r={r} onTransfer={() => setAdd({ mode: 'transfer' })} onEditWallet={setWalletId} onAddWallet={() => setWalletId('')} onEdit={setEditTx} />
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

      <AddSheet open={!!add} onClose={() => setAdd(null)} store={store} initialMode={add?.mode} initialDate={add?.date} autoScan={add?.scan} initialAmount={add?.amount} initialCategory={add?.categoryId} onSaved={onSaved} />
      <EditTxSheet tx={editTx} onClose={() => setEditTx(null)} store={store} />
      <CategorySheet id={catId} onClose={() => setCatId(null)} store={store} />
      <WalletSheet id={walletId} onClose={() => setWalletId(null)} store={store} />
      <RebalanceSheet open={rebalance} onClose={() => setRebalance(false)} store={store} r={r} onDone={(m) => { setRebalance(false); setToast({ msg: m }); }} />
      <GoalSheet id={goalId} onClose={() => setGoalId(null)} store={store} />
      <ContributeSheet id={contribId} onClose={() => setContribId(null)} store={store} onDone={(m) => { setContribId(null); setToast({ msg: m }); }} />
      <DebtSheet id={debtId} onClose={() => setDebtId(null)} store={store} />
      <PayDebtSheet id={payId} onClose={() => setPayId(null)} store={store} onDone={(m) => { setPayId(null); setToast({ msg: m }); }} />
      <GroupsSheet open={groupsOpen} onClose={() => setGroupsOpen(false)} store={store} />
      <SettingsSheet open={settings} onClose={() => setSettings(false)} store={store} ui={ui} setUi={setUi} onToast={(m) => setToast({ msg: m })}
        syncLabel={account.session?.token ? `${STATUS_LABEL[account.status]} · ${account.session.email}` : ''} onAccount={() => { setSettings(false); setAccountOpen(true); }} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} account={account}
        onSignedIn={() => { setUi({ ...ui, onboarded: true }); setToast({ msg: 'Connecté ! Tes données sont sauvegardées.' }); }} />

      {!ui.onboarded && !accountOpen && store.state.txs.length === 0 && store.state.settings.expectedIncome === 0 && (
        <Welcome store={store} onLogin={() => setAccountOpen(true)} onDone={() => { setUi({ ...ui, onboarded: true }); setTab('budget'); setToast({ msg: 'Bienvenue ! Ton budget est prêt.' }); }} />
      )}

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
