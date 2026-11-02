import { useEffect, useMemo, useRef, useState } from 'react';
import { LuCheck, LuDownload, LuLock, LuMoon, LuPalette, LuSparkles, LuSun, LuTrash2, LuUpload, LuShieldCheck, LuDatabase } from 'react-icons/lu';
import type { Category, CategoryKind, MonthReport, State, Tx, Wallet } from '../engine';
import { applyRebalance, fmt, proposeRebalance, toCSV, walletReports, toISODate, type RebalanceProposal } from '../engine';
import type { Store, ThemeId, UiPrefs } from '../store';
import { download, uid } from '../store';
import { Btn, Label, Money, Segmented, Sheet, cx, inputCls } from '../ui';
import { APP } from '../config';
import { CARD_COLORS } from '../screens/Money';
import { Glyph, ICON_SECTIONS, fileToLogo } from '../icons';
import { LuImagePlus } from 'react-icons/lu';

// ---------------------------------------------------------------------
// Modifier / supprimer une opération (avec traçabilité)
// ---------------------------------------------------------------------
export function EditTxSheet({ tx, onClose, store }: { tx: Tx | null; onClose: () => void; store: Store }) {
  const [d, setD] = useState<Tx | null>(tx);
  const [confirmDel, setConfirmDel] = useState(false);
  useEffect(() => { setD(tx); setConfirmDel(false); }, [tx]);
  if (!tx || !d) return null;
  const { state } = store;
  const cats = tx.type === 'income' ? state.incomeCategories : state.categories;
  const save = () => {
    const patch: Partial<Tx> = {};
    (['amount', 'date', 'categoryId', 'walletId', 'fromWalletId', 'toWalletId', 'note'] as const).forEach((k) => {
      if (d[k] !== tx[k]) (patch as any)[k] = d[k];
    });
    if (Object.keys(patch).length) store.updateTx(tx.id, patch);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title="Modifier l’opération"
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2 pb-1">
          <Btn variant="danger" onClick={() => (confirmDel ? (store.deleteTx(tx.id), onClose()) : setConfirmDel(true))}>
            <LuTrash2 /> {confirmDel ? 'Confirmer' : ''}
          </Btn>
          <Btn onClick={save}><LuCheck /> Enregistrer</Btn>
        </div>
      }>
      <Label>Montant (FCFA)</Label>
      <input inputMode="numeric" value={d.amount} onChange={(e) => setD({ ...d, amount: Number(e.target.value.replace(/\D/g, '')) || 0 })} className={cx(inputCls, 'num text-xl font-bold')} />
      {tx.type !== 'transfer' ? (
        <>
          <Label>Catégorie</Label>
          <select value={d.categoryId} onChange={(e) => setD({ ...d, categoryId: e.target.value })} className={inputCls}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.hidden ? ' (masquée)' : ''}</option>)}
          </select>
          <Label>Portefeuille</Label>
          <select value={d.walletId} onChange={(e) => setD({ ...d, walletId: e.target.value })} className={inputCls}>
            {state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Depuis</Label>
            <select value={d.fromWalletId} onChange={(e) => setD({ ...d, fromWalletId: e.target.value })} className={inputCls}>
              {state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select></div>
          <div><Label>Vers</Label>
            <select value={d.toWalletId} onChange={(e) => setD({ ...d, toWalletId: e.target.value })} className={inputCls}>
              {state.wallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select></div>
        </div>
      )}
      <Label>Date</Label>
      <input type="date" value={d.date} onChange={(e) => setD({ ...d, date: e.target.value })} className={inputCls} />
      <Label>Note</Label>
      <input value={d.note ?? ''} onChange={(e) => setD({ ...d, note: e.target.value })} className={inputCls} />
      {tx.history?.length ? (
        <>
          <Label>Historique des modifications</Label>
          <ul className="space-y-1 text-[12px] text-muted">
            {tx.history.map((h, i) => (
              <li key={i} className="rounded-xl bg-surface2 px-3 py-2">
                {new Date(h.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })} — avant :{' '}
                {Object.entries(h.before).map(([k, v]) => `${k} = ${k === 'amount' ? fmt(Number(v)) + ' F' : v ?? '—'}`).join(', ')}
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Assistant de rééquilibrage
// ---------------------------------------------------------------------
export function RebalanceSheet({ open, onClose, store, r, onDone }: { open: boolean; onClose: () => void; store: Store; r: MonthReport; onDone: (m: string) => void }) {
  const base = useMemo(() => proposeRebalance(store.state, r), [store.state, r]);
  const [cuts, setCuts] = useState<Record<string, number>>({});
  useEffect(() => { if (open) setCuts(Object.fromEntries(base.cuts.map((c) => [c.id, c.from - c.to]))); }, [open, base]);

  // Toutes les catégories flexibles / ajustables avec une marge sont candidates.
  const candidates = useMemo(() => {
    return r.categories
      .filter((c) => (c.kind === 'flexible' || c.kind === 'unexpected' || c.kind === 'adjustable') && c.spent <= c.budget && c.budget > 0)
      .map((c) => {
        const cat = store.state.categories.find((x) => x.id === c.id)!;
        const floor = c.kind === 'adjustable' ? Math.max(c.spent, Math.round(c.budget * (1 - (cat.maxCut ?? 0.2)))) : c.spent;
        return { ...c, margin: Math.max(0, c.budget - floor) };
      })
      .filter((c) => c.margin > 0)
      .sort((a, b) => (a.kind === 'adjustable' ? 1 : 0) - (b.kind === 'adjustable' ? 1 : 0));
  }, [r, store.state.categories]);

  const covered = Object.values(cuts).reduce((a, b) => a + b, 0);
  const residual = Math.max(0, base.overspend - covered);
  const proposal: RebalanceProposal = {
    ...base,
    cuts: Object.entries(cuts).filter(([, v]) => v > 0).map(([id, v]) => {
      const c = r.categories.find((x) => x.id === id)!;
      return { id, from: c.budget, to: c.budget - v, margin: 0 };
    }),
    covered: Math.min(covered, base.overspend),
    residualDeficit: residual,
  };

  return (
    <Sheet open={open} onClose={onClose} title="Assistant de rééquilibrage" icon={<LuSparkles className="text-primary" />}
      footer={
        <div className="grid grid-cols-2 gap-2 pb-1">
          <Btn variant="ghost" onClick={onClose}>Refuser</Btn>
          <Btn onClick={() => { store.setCategories(applyRebalance(store.state, proposal)); onDone('Nouveaux plafonds appliqués'); }} disabled={base.overspend === 0}>
            Appliquer
          </Btn>
        </div>
      }>
      {base.overspend === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Aucun dépassement : tout est équilibré ce mois-ci.</p>
      ) : (
        <>
          <div className="rounded-2xl bg-surface2 p-3 text-[13px] leading-snug">
            {base.covers.map((c) => {
              const cat = r.categories.find((x) => x.id === c.id)!;
              return <div key={c.id}><b>{cat.name}</b> a besoin de <b>{fmt(c.to - c.from)} F</b> de plus que prévu.</div>;
            })}
            <div className="mt-1">Bonne nouvelle : on peut le compenser sans toucher à tes obligations. Voici ma proposition, ajuste-la si tu veux :</div>
          </div>

          <div className="mt-3 space-y-2">
            {candidates.map((c) => {
              const v = cuts[c.id] ?? 0;
              return (
                <div key={c.id} className="card p-3">
                  <div className="flex items-center justify-between text-[13px]">
                    <span className="font-semibold">{c.name} <span className="text-[11px] font-normal text-muted">({c.kind === 'adjustable' ? 'ajustable' : c.kind === 'unexpected' ? 'imprévu' : 'flexible'})</span></span>
                    <span className="num"><span className="text-muted">{fmt(c.budget)} →</span> <b>{fmt(c.budget - v)}</b></span>
                  </div>
                  <div className="mt-1 flex items-center gap-3">
                    <input type="range" min={0} max={c.margin} step={500} value={v} onChange={(e) => setCuts({ ...cuts, [c.id]: Number(e.target.value) })} className="flex-1" />
                    <span className="num w-20 text-right text-[13px] font-bold">−{fmt(v)}</span>
                  </div>
                  <div className="text-[10.5px] text-muted">Marge réelle : {fmt(c.margin)} F (déjà dépensé : {fmt(c.spent)} F)</div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-2xl bg-surface2 p-2.5"><div className="text-[11px] text-muted">Couvert</div><Money v={Math.min(covered, base.overspend)} className="text-[16px] font-bold text-ok" /></div>
            <div className="rounded-2xl bg-surface2 p-2.5"><div className="text-[11px] text-muted">Déficit résiduel</div><Money v={residual} className={cx('text-[16px] font-bold', residual > 0 ? 'text-danger' : '')} /></div>
          </div>
          {residual > 0 && (
            <p className="mt-2 text-[12px] text-danger">Les économies possibles ne suffisent pas : le déficit restant est affiché tel quel, sans équilibre artificiel.</p>
          )}
          <p className="mt-2 flex items-center gap-1.5 rounded-2xl bg-primary/10 p-2.5 text-[12px]">
            <LuLock className="shrink-0 text-primary" /> Loyer, factures, scolarité et épargne restent inchangés. L’historique n’est jamais modifié.
          </p>
        </>
      )}
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Catégorie : modifier, créer, masquer
// ---------------------------------------------------------------------
const KINDS: { value: CategoryKind; label: string; hint: string }[] = [
  { value: 'obligatory', label: 'Obligatoire', hint: 'Protégée, jamais réduite automatiquement' },
  { value: 'adjustable', label: 'Nécessaire', hint: 'Ajustable dans une limite que tu fixes' },
  { value: 'flexible', label: 'Flexible', hint: 'Première candidate à une réduction' },
  { value: 'savings', label: 'Épargne', hint: 'Mise de côté planifiée' },
  { value: 'unexpected', label: 'Imprévu', hint: 'Réserve pour les surprises' },
];

export function CategorySheet({ id, onClose, store }: { id: string | null; onClose: () => void; store: Store }) {
  const existing = store.state.categories.find((c) => c.id === id);
  const [c, setC] = useState<Category | null>(null);
  useEffect(() => {
    if (id === null) { setC(null); return; }
    setC(existing ? { ...existing } : { id: uid('c'), name: '', icon: 'tag', kind: 'flexible', budget: 10000, group: 'g_other' });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!c) return null;
  const used = store.state.txs.some((t) => t.categoryId === c.id);
  const save = () => {
    if (!c.name.trim()) return;
    if (existing) store.updateCategory(c.id, c); else store.addCategory(c);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={existing ? 'Enveloppe' : 'Nouvelle catégorie'}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2 pb-1">
          {existing && (
            <Btn variant="soft" onClick={() => { store.updateCategory(c.id, { hidden: !c.hidden }); onClose(); }}>
              {c.hidden ? 'Afficher' : 'Masquer'}
            </Btn>
          )}
          <Btn onClick={save} className={existing ? '' : 'col-span-2'}><LuCheck /> Enregistrer</Btn>
        </div>
      }>
      <Label>Nom</Label>
      <input value={c.name} onChange={(e) => setC({ ...c, name: e.target.value })} className={inputCls} placeholder="Ex : Cotisation association" />
      <IconField icon={c.icon} logo={c.logo} name={c.name} onIcon={(icon) => setC({ ...c, icon, logo: undefined })} onLogo={(logo) => setC({ ...c, logo })} />
      <Label>Plafond mensuel (FCFA)</Label>
      <input inputMode="numeric" value={c.budget} onChange={(e) => setC({ ...c, budget: Number(e.target.value.replace(/\D/g, '')) || 0 })} className={cx(inputCls, 'num text-lg font-bold')} />
      <div className="grid grid-cols-[1fr_96px] gap-2">
        <div>
          <Label>Groupe</Label>
          <select value={c.group ?? 'g_other'} onChange={(e) => setC({ ...c, group: e.target.value })} className={inputCls}>
            {(store.state.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </div>
        <div>
          <Label>Jour</Label>
          <input inputMode="numeric" value={c.dueDay ?? ''} placeholder="—" onChange={(e) => setC({ ...c, dueDay: Math.min(31, Number(e.target.value.replace(/\D/g, ''))) || undefined })} className={cx(inputCls, 'text-center')} aria-label="Jour du mois de l’échéance" />
        </div>
      </div>
      <p className="mt-1 text-[11px] text-muted">Le jour (facultatif) place cette charge dans le calendrier : loyer le 5, CIE le 15…</p>
      <Label>Type de dépense</Label>
      <div className="space-y-1.5">
        {KINDS.map((k) => (
          <button key={k.value} onClick={() => setC({ ...c, kind: k.value })} className={cx('flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left', c.kind === k.value ? 'border-primary bg-primary/10' : 'border-line bg-surface')}>
            <span><span className="block text-[14px] font-semibold">{k.label}</span><span className="block text-[11.5px] text-muted">{k.hint}</span></span>
            {c.kind === k.value && <LuCheck className="text-primary" />}
          </button>
        ))}
      </div>
      {c.kind === 'adjustable' && (
        <>
          <Label>Réduction maximale autorisée : {Math.round((c.maxCut ?? 0.2) * 100)} %</Label>
          <input type="range" min={0} max={50} step={5} value={Math.round((c.maxCut ?? 0.2) * 100)} onChange={(e) => setC({ ...c, maxCut: Number(e.target.value) / 100 })} className="w-full" />
        </>
      )}
      {existing && used && <p className="mt-3 text-[11.5px] text-muted">Cette catégorie a un historique : elle peut être masquée mais pas supprimée, pour ne pas casser tes anciennes opérations.</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Portefeuille : ajuster le solde réel, créer
// ---------------------------------------------------------------------
export function WalletSheet({ id, onClose, store }: { id: string | null; onClose: () => void; store: Store }) {
  const existing = store.state.wallets.find((w) => w.id === id);
  const current = existing ? walletReports(store.state, '9999-12-31').find((w) => w.id === existing.id)?.balance ?? 0 : 0;
  const [w, setW] = useState<Wallet | null>(null);
  const [declared, setDeclared] = useState('');
  useEffect(() => {
    if (id === null) { setW(null); return; }
    setW(existing ? { ...existing } : { id: uid('w'), name: '', icon: '', initialBalance: 0, source: 'declared', updatedAt: new Date().toISOString() });
    setDeclared(String(existing ? current : 0));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!w) return null;
  const save = () => {
    if (!w.name.trim()) return;
    const target = Number(declared.replace(/\D/g, '').replace(/^$/, '0')) * (declared.trim().startsWith('-') ? -1 : 1);
    // Ajuster le solde réel : on corrige le solde initial déclaré, sans créer de fausse dépense.
    const initialBalance = existing ? w.initialBalance + (target - current) : target;
    if (existing) store.updateWallet(w.id, { ...w, initialBalance }); else store.addWallet({ ...w, initialBalance });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={existing ? `Ajuster ${existing.name}` : 'Nouveau portefeuille'}
      footer={<div className="pb-1"><Btn onClick={save} className="w-full"><LuCheck /> Enregistrer</Btn></div>}>
      <Label>Nom</Label>
      <input value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} className={inputCls} placeholder="Ex : Djamo, Tontine…" />
      <IconField icon={w.icon} logo={w.logo} name={w.name} onIcon={(icon) => setW({ ...w, icon, logo: undefined })} onLogo={(logo) => setW({ ...w, logo })} allowInitials />
      <Label>Solde réel actuel (FCFA)</Label>
      <input inputMode="numeric" value={declared} onChange={(e) => setDeclared(e.target.value)} className={cx(inputCls, 'num text-lg font-bold')} />
      {existing && <p className="mt-1 text-[11.5px] text-muted">Solde calculé par l’application : {fmt(current)} F. Saisis le montant que tu vois vraiment sur ton téléphone ou dans ta poche.</p>}
      <Label>Couleur de la carte</Label>
      <div className="flex gap-2">
        {CARD_COLORS.map((col) => (
          <button key={col} onClick={() => setW({ ...w, color: col })} aria-label="Couleur"
            className={cx('h-9 w-9 rounded-xl', (w.color ?? '') === col && 'ring-2 ring-ink ring-offset-2')} style={{ background: col }} />
        ))}
      </div>
      <label className="mt-4 flex items-center justify-between rounded-2xl bg-surface2 px-3 py-3 text-[14px]">
        <span>Argent mis de côté (épargne)<span className="block text-[11.5px] text-muted">Exclu de l’argent disponible au quotidien</span></span>
        <input type="checkbox" checked={!!w.reserved} onChange={(e) => setW({ ...w, reserved: e.target.checked })} className="h-5 w-5 accent-[var(--s-primary)]" />
      </label>
      {existing && (
        <label className="mt-2 flex items-center justify-between rounded-2xl bg-surface2 px-3 py-3 text-[14px]">
          <span>Masquer ce portefeuille</span>
          <input type="checkbox" checked={!!w.hidden} onChange={(e) => setW({ ...w, hidden: e.target.checked })} className="h-5 w-5" />
        </label>
      )}
      <p className="mt-3 text-[11.5px] text-muted">Solde déclaré manuellement. Aucune connexion à ta banque ou à ton opérateur.</p>
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Réglages : modèles d’interface, mode sombre, budget, données
// ---------------------------------------------------------------------
export const THEMES: { id: ThemeId; name: string; desc: string; hero: string; bg: string; card: string; ink: string }[] = [
  { id: 'emeraude', name: 'Émeraude', desc: 'Clair et rassurant', hero: '#087B48', bg: '#F5F8F6', card: '#fff', ink: '#172B23' },
  { id: 'nuit', name: 'Nuit dorée', desc: 'Sombre, reposant', hero: '#14271E', bg: '#070F0B', card: '#0F1C16', ink: '#E3B04B' },
  { id: 'wax', name: 'Wax', desc: 'Chaleureux, terre cuite', hero: '#C9471F', bg: '#FBF3E6', card: '#FFFCF6', ink: '#2B1A0F' },
  { id: 'lagune', name: 'Lagune', desc: 'Frais, bleu-vert', hero: '#0E7C7B', bg: '#EEF5F6', card: '#fff', ink: '#0E2A33' },
];

export function SettingsSheet({
  open, onClose, store, ui, setUi, onToast, syncLabel, onAccount,
}: { open: boolean; onClose: () => void; store: Store; ui: UiPrefs; setUi: (u: UiPrefs) => void; onToast: (m: string) => void; syncLabel: string; onAccount: () => void }) {
  const { state } = store;
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState(false);
  const [presets, setPresets] = useState(state.settings.presets.join(', '));
  useEffect(() => { if (open) { setPresets(state.settings.presets.join(', ')); setConfirm(false); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const importFile = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as State;
      if (!Array.isArray(data.txs) || !Array.isArray(data.categories) || !Array.isArray(data.wallets)) throw new Error('format');
      store.importState(data);
      onToast('Sauvegarde restaurée');
    } catch {
      onToast('Fichier de sauvegarde invalide');
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title="Réglages" tall>
      <Label><span className="inline-flex items-center gap-1"><LuPalette /> Modèle d’interface</span></Label>
      <div className="grid grid-cols-2 gap-2">
        {THEMES.map((t) => (
          <button key={t.id} onClick={() => setUi({ ...ui, theme: t.id })}
            className={cx('overflow-hidden rounded-2xl border-2 text-left transition', ui.theme === t.id ? 'border-primary' : 'border-transparent')}>
            <div className="p-2" style={{ background: t.bg }}>
              <div className="h-12 rounded-xl p-1.5" style={{ background: t.hero }}>
                <div className="h-2 w-10 rounded bg-white/70" />
                <div className="mt-1 h-3 w-16 rounded bg-white/90" />
              </div>
              <div className="mt-1.5 grid grid-cols-2 gap-1">
                {[0, 1].map((i) => <div key={i} className="h-5 rounded-md" style={{ background: t.card, boxShadow: '0 1px 2px rgba(0,0,0,.1)' }} />)}
              </div>
            </div>
            <div className="bg-surface px-2.5 py-1.5">
              <div className="flex items-center justify-between text-[13px] font-bold">{t.name}{ui.theme === t.id && <LuCheck className="text-primary" />}</div>
              <div className="text-[11px] text-muted">{t.desc}</div>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-3">
        <Segmented value={ui.dark || ui.theme === 'nuit' ? 'dark' : 'light'} onChange={(v) => setUi({ ...ui, dark: v === 'dark' })} small
          options={[{ value: 'light', label: <span className="inline-flex items-center gap-1"><LuSun size={14} /> Clair</span> }, { value: 'dark', label: <span className="inline-flex items-center gap-1"><LuMoon size={14} /> Sombre</span> }]} />
        {ui.theme === 'nuit' && <p className="mt-1 text-[11px] text-muted">Le modèle Nuit dorée est toujours sombre.</p>}
      </div>

      <Label>Revenu mensuel prévu (FCFA)</Label>
      <input inputMode="numeric" value={state.settings.expectedIncome} onChange={(e) => store.setSettings({ expectedIncome: Number(e.target.value.replace(/\D/g, '')) || 0 })} className={cx(inputCls, 'num font-bold')} />

      <Label>Seuil d’alerte par enveloppe : {state.settings.warnPct} %</Label>
      <input type="range" min={50} max={100} step={5} value={state.settings.warnPct} onChange={(e) => store.setSettings({ warnPct: Number(e.target.value) })} className="w-full" />
      <Label>Tolérance de rythme : {state.settings.paceMargin} points</Label>
      <input type="range" min={0} max={30} step={5} value={state.settings.paceMargin} onChange={(e) => store.setSettings({ paceMargin: Number(e.target.value) })} className="w-full" />
      <p className="text-[11.5px] text-muted">Orange si tu as consommé plus que le temps écoulé + cette tolérance.</p>

      <Label>Montants rapides</Label>
      <input value={presets} onChange={(e) => setPresets(e.target.value)}
        onBlur={() => { const p = presets.split(/[,;]/).map((x) => Number(x.replace(/\D/g, ''))).filter((x) => x > 0).slice(0, 8); if (p.length) store.setSettings({ presets: p }); }}
        className={inputCls} />

      <Label><span className="inline-flex items-center gap-1"><LuDatabase /> Mes données</span></Label>
      <div className="rounded-2xl bg-surface2 p-3 text-[12.5px]">
        <div className="flex items-center gap-1.5 font-semibold"><span className="h-2 w-2 rounded-full bg-ok" /> Enregistré sur l’appareil</div>
        <div className="mt-0.5 text-muted">
          {state.txs.length} opérations. Fonctionne hors connexion.{' '}
          {syncLabel ? <>Sauvegarde en ligne : {syncLabel}.</> : 'Pas encore de sauvegarde en ligne.'}
        </div>
      </div>
      <Btn className="mt-2 w-full" variant={syncLabel ? 'ghost' : 'primary'} onClick={onAccount}>{syncLabel ? 'Mon compte' : 'Créer un compte / me connecter'}</Btn>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => download(`budget-ivoire-${toISODate(new Date())}.csv`, toCSV(state), 'text/csv;charset=utf-8')}><LuDownload /> CSV</Btn>
        <Btn variant="ghost" onClick={() => download(`budget-ivoire-sauvegarde-${toISODate(new Date())}.json`, JSON.stringify(state, null, 1), 'application/json')}><LuDownload /> Sauvegarde</Btn>
        <Btn variant="ghost" className="col-span-2" onClick={() => fileRef.current?.click()}><LuUpload /> Restaurer une sauvegarde</Btn>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => importFile(e.target.files?.[0])} />
      </div>
      <div className="mt-2">
        <Btn variant="danger" className="w-full" onClick={() => (confirm ? (store.resetAll(), setUi({ ...ui, onboarded: false }), onToast('Nouveau départ !'), onClose()) : setConfirm(true))}>
          {confirm ? 'Confirmer : tout effacer' : 'Repartir de zéro'}
        </Btn>
      </div>

      <p className="mt-4 flex items-start gap-2 rounded-2xl bg-surface2 p-3 text-[11.5px] text-muted">
        <LuShieldCheck className="mt-0.5 shrink-0 text-primary" size={16} />
        {APP.name} ne stocke jamais de code PIN Mobile Money ni de mot de passe bancaire. Tes données restent sur ce téléphone. Les conseils sont des estimations, pas des certitudes.
      </p>
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// Choix d'icône simple ou import de son propre logo (image)
// ---------------------------------------------------------------------
function IconField({
  icon, logo, name, onIcon, onLogo, allowInitials,
}: { icon: string; logo?: string; name: string; onIcon: (i: string) => void; onLogo: (l?: string) => void; allowInitials?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <Label>Logo ou icône</Label>
      <div className="flex items-center gap-3 rounded-2xl bg-surface2 p-3">
        <Glyph icon={icon} logo={logo} label={name || '?'} size={48} />
        <div className="flex-1 text-[12px] text-muted">Importe le logo de ton choix (photo ou image enregistrée sur ton téléphone), ou choisis une icône.</div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => ref.current?.click()}><LuImagePlus /> Importer un logo</Btn>
        {logo ? <Btn variant="soft" onClick={() => onLogo(undefined)}>Retirer le logo</Btn> : allowInitials ? <Btn variant="soft" onClick={() => onIcon('')}>Initiales</Btn> : <span />}
      </div>
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) onLogo(await fileToLogo(f)); e.target.value = ''; }} />
      {ICON_SECTIONS.map((sec) => (
        <div key={sec.name}>
          <div className="mb-1 mt-3 text-[11px] font-bold uppercase tracking-wide text-muted">{sec.name}</div>
          <div className="grid grid-cols-8 gap-1.5">
            {sec.keys.map((k) => (
              <button key={k} onClick={() => onIcon(k)} aria-label={k}>
                <Glyph icon={k} size={34} active={!logo && icon === k} />
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
