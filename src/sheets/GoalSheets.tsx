import { useEffect, useRef, useState } from 'react';
import { LuCheck, LuImagePlus, LuTrash2 } from 'react-icons/lu';
import type { Debt, Goal, Group } from '../engine';
import { fmt, goalSaved, monthKey, shiftMonth, toISODate } from '../engine';
import type { Store } from '../store';
import { uid } from '../store';
import { DEFAULT_GROUPS } from '../data';
import { Btn, Label, Segmented, Sheet, cx, inputCls } from '../ui';
import { Glyph } from '../icons';
import { compressImage } from '../services/receipt';
import { Keypad } from './Welcome';

const num = (v: string) => Number(v.replace(/\D/g, '')) || 0;

function WalletChoice({ store, value, onChange, exclude }: { store: Store; value: string; onChange: (id: string) => void; exclude?: string }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {store.state.wallets.filter((w) => !w.hidden && w.id !== exclude).map((w) => (
        <button key={w.id} onClick={() => onChange(w.id)} className={cx('flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2', value === w.id ? 'border-primary bg-primary/10' : 'border-line bg-surface')}>
          <Glyph icon={w.icon} logo={w.logo} label={w.name} size={26} />
          <span className="text-[12.5px] font-semibold">{w.name}</span>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------
export function GoalSheet({ id, onClose, store }: { id: string | null; onClose: () => void; store: Store }) {
  const existing = store.state.goals?.find((g) => g.id === id);
  const [g, setG] = useState<Goal | null>(null);
  const [del, setDel] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (id === null) { setG(null); return; }
    setDel(false);
    setG(existing ? { ...existing } : { id: uid('goal'), name: '', target: 0, deadline: shiftMonth(monthKey(new Date()), 6), contributions: [], createdAt: new Date().toISOString() });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!g) return null;
  const save = () => {
    if (!g.name.trim() || g.target <= 0) return;
    store.setAll((s) => ({ ...s, goals: existing ? (s.goals ?? []).map((x) => (x.id === g.id ? g : x)) : [...(s.goals ?? []), g] }));
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={existing ? 'Modifier l’objectif' : 'Nouvel objectif'}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2 pb-1">
          {existing ? <Btn variant="danger" onClick={() => (del ? (store.setAll((s) => ({ ...s, goals: (s.goals ?? []).filter((x) => x.id !== g.id) })), onClose()) : setDel(true))}><LuTrash2 /> {del ? 'Confirmer' : ''}</Btn> : <span />}
          <Btn onClick={save} disabled={!g.name.trim() || g.target <= 0}><LuCheck /> Enregistrer</Btn>
        </div>
      }>
      <Label>Mon projet</Label>
      <input value={g.name} onChange={(e) => setG({ ...g, name: e.target.value })} placeholder="Ex : Voyage à Assinie, moto, mariage…" className={inputCls} />
      <Label>Montant à atteindre (FCFA)</Label>
      <input inputMode="numeric" value={g.target ? fmt(g.target) : ''} onChange={(e) => setG({ ...g, target: num(e.target.value) })} placeholder="0" className={cx(inputCls, 'num text-lg font-bold')} />
      <Label>D’ici</Label>
      <input type="month" value={g.deadline} onChange={(e) => setG({ ...g, deadline: e.target.value })} className={inputCls} />
      <Label>Image (facultatif)</Label>
      <button onClick={() => ref.current?.click()} className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-line text-[13px] font-semibold text-muted">
        {g.image ? <img src={g.image} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <span className="flex items-center gap-2"><LuImagePlus size={18} /> Choisir une photo qui te motive</span>}
      </button>
      {g.image && <button onClick={() => setG({ ...g, image: undefined })} className="mt-1 text-[12px] font-semibold text-muted">Retirer l’image</button>}
      <input ref={ref} type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) { const { preview } = await compressImage(f, 900); setG((x) => x && { ...x, image: preview }); } e.target.value = ''; }} />
      {existing && <p className="mt-3 text-[12px] text-muted">Déjà épargné : {fmt(goalSaved(g))} F.</p>}
    </Sheet>
  );
}

// ---------------------------------------------------------------------
export function ContributeSheet({ id, onClose, store, onDone }: { id: string | null; onClose: () => void; store: Store; onDone: (m: string) => void }) {
  const goal = store.state.goals?.find((g) => g.id === id);
  const [amount, setAmount] = useState(0);
  const [from, setFrom] = useState('w_cash');
  useEffect(() => { setAmount(0); }, [id]);
  if (!goal) return null;
  const save = () => {
    if (amount <= 0) return;
    const date = toISODate(new Date());
    // L'argent quitte le portefeuille choisi et rejoint « Épargne » : ce n'est pas une dépense.
    if (from !== 'w_savings') store.addTx({ type: 'transfer', amount, date, fromWalletId: from, toWalletId: 'w_savings', note: `Objectif : ${goal.name}` });
    store.setAll((s) => ({
      ...s,
      wallets: s.wallets.map((w) => (w.id === 'w_savings' ? { ...w, hidden: false } : w)),
      goals: (s.goals ?? []).map((g) => (g.id === goal.id ? { ...g, contributions: [...g.contributions, { date, amount, walletId: from }] } : g)),
    }));
    onDone(`${fmt(amount)} F mis de côté pour « ${goal.name} »`);
  };
  return (
    <Sheet open onClose={onClose} title={`Pour « ${goal.name} »`} footer={<div className="pb-1"><Btn className="w-full" onClick={save} disabled={amount <= 0}><LuCheck /> Mettre de côté {amount ? fmt(amount) + ' F' : ''}</Btn></div>}>
      <div className="num py-2 text-center text-[40px] font-extrabold">{fmt(amount)} F</div>
      <Keypad value={amount} onChange={setAmount} />
      <Label>Depuis</Label>
      <WalletChoice store={store} value={from} onChange={setFrom} />
      <p className="mt-2 text-[11.5px] text-muted">L’argent est déplacé vers ton portefeuille « Épargne » : ton patrimoine ne baisse pas.</p>
    </Sheet>
  );
}

// ---------------------------------------------------------------------
export function DebtSheet({ id, onClose, store }: { id: string | null; onClose: () => void; store: Store }) {
  const existing = store.state.debts?.find((d) => d.id === id);
  const [d, setD] = useState<Debt | null>(null);
  const [del, setDel] = useState(false);
  useEffect(() => {
    if (id === null) { setD(null); return; }
    setDel(false);
    setD(existing ? { ...existing } : { id: uid('debt'), name: '', direction: 'owe', total: 0, paid: 0 });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!d) return null;
  const catId = 'c_debt_' + d.id;
  const save = () => {
    if (!d.name.trim() || d.total <= 0) return;
    store.setAll((s) => {
      const debts = existing ? (s.debts ?? []).map((x) => (x.id === d.id ? d : x)) : [...(s.debts ?? []), d];
      // Une mensualité « je dois » devient une charge protégée, visible dans le calendrier.
      let categories = s.categories.filter((c) => c.id !== catId);
      if (d.direction === 'owe' && d.monthly) {
        const prev = s.categories.find((c) => c.id === catId);
        categories = [...categories, { ...(prev ?? {}), id: catId, name: d.name, icon: 'bank', kind: 'obligatory', budget: d.monthly, group: 'g_debt', dueDay: d.dueDay }];
      }
      return { ...s, debts, categories };
    });
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={existing ? 'Modifier' : 'Nouveau crédit ou prêt'}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2 pb-1">
          {existing ? <Btn variant="danger" onClick={() => (del ? (store.setAll((s) => ({ ...s, debts: (s.debts ?? []).filter((x) => x.id !== d.id), categories: s.categories.map((c) => (c.id === catId ? { ...c, hidden: true, budget: 0 } : c)) })), onClose()) : setDel(true))}><LuTrash2 /> {del ? 'Confirmer' : ''}</Btn> : <span />}
          <Btn onClick={save} disabled={!d.name.trim() || d.total <= 0}><LuCheck /> Enregistrer</Btn>
        </div>
      }>
      <Segmented value={d.direction} onChange={(v) => setD({ ...d, direction: v })} options={[{ value: 'owe', label: 'Je dois' }, { value: 'owed', label: 'On me doit' }]} />
      <Label>{d.direction === 'owe' ? 'Auprès de / pour quoi' : 'Qui me doit'}</Label>
      <input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder={d.direction === 'owe' ? 'Ex : Prêt moto, crédit banque' : 'Ex : Prêt à Koffi'} className={inputCls} />
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Montant total</Label><input inputMode="numeric" value={d.total ? fmt(d.total) : ''} onChange={(e) => setD({ ...d, total: num(e.target.value) })} placeholder="0" className={cx(inputCls, 'num font-bold')} /></div>
        <div><Label>Déjà {d.direction === 'owe' ? 'remboursé' : 'récupéré'}</Label><input inputMode="numeric" value={d.paid ? fmt(d.paid) : ''} onChange={(e) => setD({ ...d, paid: num(e.target.value) })} placeholder="0" className={cx(inputCls, 'num font-bold')} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Par mois (facultatif)</Label><input inputMode="numeric" value={d.monthly ? fmt(d.monthly) : ''} onChange={(e) => setD({ ...d, monthly: num(e.target.value) || undefined })} placeholder="0" className={cx(inputCls, 'num')} /></div>
        <div><Label>Jour du mois</Label><input inputMode="numeric" value={d.dueDay ?? ''} onChange={(e) => setD({ ...d, dueDay: Math.min(31, num(e.target.value)) || undefined })} placeholder="ex : 28" className={inputCls} /></div>
      </div>
      {d.direction === 'owed' && <p className="mt-3 text-[12px] text-muted">Cet argent n’est pas compté comme revenu tant qu’il ne t’a pas été rendu.</p>}
    </Sheet>
  );
}

export function PayDebtSheet({ id, onClose, store, onDone }: { id: string | null; onClose: () => void; store: Store; onDone: (m: string) => void }) {
  const debt = store.state.debts?.find((d) => d.id === id);
  const [amount, setAmount] = useState(0);
  const [wallet, setWallet] = useState('w_cash');
  useEffect(() => { setAmount(debt?.monthly ?? 0); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!debt) return null;
  const save = () => {
    if (amount <= 0) return;
    const date = toISODate(new Date());
    const catId = store.state.categories.some((c) => c.id === 'c_debt_' + debt.id) ? 'c_debt_' + debt.id : 'c_loan';
    if (debt.direction === 'owe') store.addTx({ type: 'expense', amount, date, categoryId: catId, walletId: wallet, note: `Remboursement : ${debt.name}` });
    else store.addTx({ type: 'income', amount, date, categoryId: 'i_refund', walletId: wallet, note: `Remboursé par : ${debt.name}` });
    store.setAll((s) => ({ ...s, debts: (s.debts ?? []).map((d) => (d.id === debt.id ? { ...d, paid: Math.min(d.total, d.paid + amount) } : d)) }));
    onDone(debt.direction === 'owe' ? 'Remboursement enregistré' : 'Paiement reçu enregistré');
  };
  return (
    <Sheet open onClose={onClose} title={debt.name} footer={<div className="pb-1"><Btn className="w-full" onClick={save} disabled={amount <= 0}><LuCheck /> Valider {amount ? fmt(amount) + ' F' : ''}</Btn></div>}>
      <div className="num py-2 text-center text-[40px] font-extrabold">{fmt(amount)} F</div>
      <Keypad value={amount} onChange={setAmount} />
      <Label>{debt.direction === 'owe' ? 'Payé avec' : 'Reçu sur'}</Label>
      <WalletChoice store={store} value={wallet} onChange={setWallet} />
    </Sheet>
  );
}

// ---------------------------------------------------------------------
const PALETTE = Array.from(new Set(DEFAULT_GROUPS.map((g) => g.color)));

export function GroupsSheet({ open, onClose, store }: { open: boolean; onClose: () => void; store: Store }) {
  const [groups, setGroups] = useState<Group[]>([]);
  useEffect(() => { if (open) setGroups((store.state.groups ?? []).map((g) => ({ ...g }))); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = () => { store.setAll((s) => ({ ...s, groups: groups.filter((g) => g.name.trim()) })); onClose(); };
  return (
    <Sheet open={open} onClose={onClose} title="Mes groupes" footer={<div className="pb-1"><Btn className="w-full" onClick={save}><LuCheck /> Enregistrer</Btn></div>}>
      <p className="text-[12.5px] text-muted">Renomme tes groupes et choisis leur couleur. Pour déplacer une catégorie, ouvre-la depuis l’onglet Budget.</p>
      {groups.map((g, i) => (
        <div key={g.id} className="card mt-2 p-3">
          <div className="flex items-center gap-2">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white" style={{ background: g.color }}><Glyph icon={g.icon} size={36} plain /></span>
            <input value={g.name} onChange={(e) => setGroups(groups.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} className={cx(inputCls, 'py-2')} />
          </div>
          <div className="mt-2 flex gap-1.5">
            {PALETTE.map((c) => (
              <button key={c} onClick={() => setGroups(groups.map((x, j) => (j === i ? { ...x, color: c } : x)))} aria-label="Couleur"
                className={cx('h-7 w-7 rounded-full', g.color === c && 'ring-2 ring-ink ring-offset-2')} style={{ background: c }} />
            ))}
          </div>
        </div>
      ))}
      <Btn variant="ghost" className="mt-3 w-full" onClick={() => setGroups([...groups, { id: uid('g'), name: 'Nouveau groupe', icon: 'tag', color: PALETTE[groups.length % PALETTE.length] }])}>+ Ajouter un groupe</Btn>
    </Sheet>
  );
}
