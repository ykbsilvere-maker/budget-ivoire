// Enveloppes : approvisionner depuis un compte, compléter quand il manque, cartes et évolution.
import { useEffect, useMemo, useState } from 'react';
import { LuArrowRight, LuCheck, LuPlus, LuWallet } from 'react-icons/lu';
import type { Category, State } from '../engine';
import {
  MONTHS_FR, budgetFor, envelopeShortfall, envelopeView, fmt, fmtN, fundEnvelope, monthKey, monthlyEvolution, shiftMonth, toISODate, walletFree,
} from '../engine';
import type { Store } from '../store';
import { uid } from '../store';
import { Bar, Btn, Label, Sheet, cx } from '../ui';
import { Glyph } from '../icons';
import { Keypad } from './Welcome';
import { fmtWallet, isWalletHidden } from '../services/security';

/** Compte proposé par défaut : celui qui a le plus d'argent libre (hors épargne). */
export const bestWallet = (state: State, month: string) =>
  state.wallets.filter((w) => !w.hidden && !w.reserved).map((w) => ({ id: w.id, free: walletFree(state, w.id, month).free })).sort((a, b) => b.free - a.free)[0]?.id ?? 'w_cash';

/** Liste des comptes avec leur part libre (solde − bloqué − réservé). */
export function WalletFreePicker({ store, value, onChange, month }: { store: Store; value: string; onChange: (id: string) => void; month: string }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {store.state.wallets.filter((w) => !w.hidden).map((w) => {
        const f = walletFree(store.state, w.id, month);
        return (
          <button key={w.id} onClick={() => onChange(w.id)}
            className={cx('flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left', value === w.id ? 'border-primary bg-primary/10' : 'border-line bg-surface')}>
            <Glyph icon={w.icon} logo={w.logo} label={w.name} size={30} />
            <span>
              <span className="block text-[12.5px] font-semibold leading-tight">{w.name}</span>
              <span className="num block text-[11px] leading-tight text-muted">libre {fmtWallet(w.id, f.free)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Avant → après, pour un compte et une enveloppe. */
function BeforeAfter({ label, before, after, hidden, tone }: { label: string; before: string; after: string; hidden?: boolean; tone?: 'danger' }) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-surface px-2.5 py-2 text-[12.5px]">
      <span className="min-w-0 flex-1 truncate text-muted">{label}</span>
      <span className="num whitespace-nowrap">{hidden ? '• • •' : before}</span>
      <LuArrowRight size={13} className="shrink-0 text-muted" />
      <b className={cx('num whitespace-nowrap', tone === 'danger' && 'text-danger')}>{hidden ? '• • •' : after}</b>
    </div>
  );
}

// ---------------------------------------------------------------------
// Approvisionner une enveloppe depuis un compte
// ---------------------------------------------------------------------
export interface FundTarget { categoryId?: string; date?: string }

export function FundSheet({ target, onClose, store, onDone }: { target: FundTarget | null; onClose: () => void; store: Store; onDone: (m: string) => void }) {
  const cats = store.state.categories.filter((c) => !c.hidden);
  const [cat, setCat] = useState('');
  const [wallet, setWallet] = useState('w_cash');
  const [amount, setAmount] = useState(0);
  const [date, setDate] = useState(toISODate(new Date()));
  const month = date.slice(0, 7);
  const c = cats.find((x) => x.id === cat);
  const ev = c ? envelopeView(store.state, c, month) : null;
  useEffect(() => {
    if (!target) return;
    const d = target.date ?? toISODate(new Date());
    const first = target.categoryId ?? cats.find((x) => budgetFor(x, d.slice(0, 7)) > 0)?.id ?? cats[0]?.id ?? '';
    setDate(d);
    setCat(first);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!c) return;
    setWallet(c.sourceWalletId ?? bestWallet(store.state, month));
    setAmount(envelopeView(store.state, c, month).toFund);
  }, [cat, month]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!target) return null;
  const free = walletFree(store.state, wallet, month);
  const wName = store.state.wallets.find((w) => w.id === wallet)?.name ?? '';
  const save = () => {
    if (!c || amount <= 0) return;
    store.setAll((s) => {
      const next = fundEnvelope(s, { id: uid('f'), date, categoryId: c.id, walletId: wallet, amount });
      // Le compte choisi devient la source habituelle de l'enveloppe.
      return { ...next, categories: next.categories.map((x) => (x.id === c.id && !x.sourceWalletId ? { ...x, sourceWalletId: wallet } : x)) };
    });
    onDone(`${c.name} approvisionné : ${fmt(amount)} XOF depuis ${wName}`);
  };
  const [y, m] = month.split('-').map(Number);
  return (
    <Sheet open onClose={onClose} title="Approvisionner une enveloppe"
      footer={<div className="pb-1"><Btn className="w-full" onClick={save} disabled={!c || amount <= 0}><LuWallet /> Approvisionner {amount ? fmtN(amount) + ' XOF' : ''}</Btn></div>}>
      <Label>Enveloppe</Label>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {cats.map((x) => (
          <button key={x.id} onClick={() => setCat(x.id)} className={cx('flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-1 py-2', cat === x.id ? 'border-primary bg-primary/10' : 'border-transparent')}>
            <Glyph icon={x.icon} logo={x.logo} label={x.name} size={36} />
            <span className="w-full truncate text-center text-[10.5px] font-semibold">{x.name}</span>
          </button>
        ))}
      </div>
      {ev && <p className="mt-1 text-[12px] text-muted">{MONTHS_FR[m - 1]} {y} : budget {fmt(ev.budget)} · déjà approvisionné {fmt(ev.funded)} · dépensé {fmt(ev.spent)}</p>}
      <div className="num py-2 text-center text-[36px] font-extrabold">{fmtN(amount)} XOF</div>
      <Keypad value={amount} onChange={setAmount} />
      <Label>Depuis le compte</Label>
      <WalletFreePicker store={store} value={wallet} onChange={setWallet} month={month} />
      {c && ev && (
        <div className="mt-2 space-y-1.5 rounded-2xl bg-surface2 p-2.5">
          <BeforeAfter label={`${wName} · libre`} before={fmt(free.free)} after={fmt(free.free - amount)} hidden={isWalletHidden(wallet)} tone={free.free - amount < 0 ? 'danger' : undefined} />
          <BeforeAfter label={`${c.name} · approvisionné`} before={fmt(ev.funded)} after={`${fmt(ev.funded + amount)} / ${fmt(Math.max(ev.budget, ev.funded + amount))}`} />
          {free.free - amount < 0 && <p className="px-1 text-[11.5px] font-semibold text-danger">Le compte n’a pas assez d’argent libre : vérifie son solde ou choisis un autre compte.</p>}
          {ev.funded + amount > ev.budget && <p className="px-1 text-[11.5px] text-muted">Le budget de {MONTHS_FR[m - 1]} passera à {fmt(ev.funded + amount)} XOF.</p>}
        </div>
      )}
      <p className="mt-2 text-[11.5px] text-muted">L’argent reste sur {wName || 'le compte'}, réservé à l’enveloppe : tes dépenses dans cette enveloppe le consomment.</p>
      <Label>Date</Label>
      <input type="date" value={date} onChange={(e) => setDate(e.target.value || date)} className="w-full rounded-2xl border border-line bg-surface px-3 py-2.5 text-[14px]" />
    </Sheet>
  );
}

// ---------------------------------------------------------------------
// « Pas assez dans l'enveloppe » : compléter depuis un compte
// ---------------------------------------------------------------------
export interface TopUp { on: boolean; walletId: string }

export function TopUpPanel({ store, categoryId, amount, date, value, onChange }: {
  store: Store; categoryId?: string; amount: number; date: string; value: TopUp; onChange: (t: TopUp) => void;
}) {
  const month = date.slice(0, 7);
  const short = envelopeShortfall(store.state, categoryId, amount, month);
  if (!short) return null;
  const c = store.state.categories.find((x) => x.id === categoryId)!;
  const free = walletFree(store.state, value.walletId, month);
  const wName = store.state.wallets.find((w) => w.id === value.walletId)?.name ?? '';
  return (
    <div className="mt-2 rounded-2xl border border-warn/40 bg-warn/10 p-3 text-[12.5px]">
      <div className="font-bold">Pas assez dans « {c.name} »</div>
      <div className="mt-0.5">Il reste {fmt(Math.max(0, short.left))} XOF sur {fmt(short.budget)}. Il manque <b>{fmt(short.missing)} XOF</b>.</div>
      <label className="mt-2 flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} className="h-4 w-4 accent-[var(--s-primary)]" />
        Compléter l’enveloppe de {fmt(short.missing)} XOF depuis :
      </label>
      {value.on && (
        <>
          <div className="mt-2"><WalletFreePicker store={store} value={value.walletId} onChange={(w) => onChange({ ...value, walletId: w })} month={month} /></div>
          <div className="mt-1.5 space-y-1.5">
            <BeforeAfter label={`${wName} · libre`} before={fmt(free.free)} after={fmt(free.free - short.missing)} hidden={isWalletHidden(value.walletId)} tone={free.free - short.missing < 0 ? 'danger' : undefined} />
            <BeforeAfter label={`${c.name} · budget du mois`} before={fmt(short.budget)} after={fmt(short.budget + short.missing)} />
          </div>
        </>
      )}
      {!value.on && <p className="mt-1 text-muted">La dépense sera enregistrée et l’enveloppe affichée en dépassement.</p>}
    </div>
  );
}

// ---------------------------------------------------------------------
// Cartes d'enveloppes, lisibles d'un coup d'œil (comme les comptes)
// ---------------------------------------------------------------------
export function EnvelopeCards({ state, month, onOpen, onFund, groupColor }: {
  state: State; month: string; onOpen: (id: string) => void; onFund: (id: string) => void; groupColor: (c: Category) => string;
}) {
  const cats = state.categories.filter((c) => !c.hidden && (budgetFor(c, month) > 0 || state.txs.some((t) => t.categoryId === c.id && t.date.startsWith(month))));
  const wName = (id?: string) => state.wallets.find((w) => w.id === id);
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {cats.map((c) => {
        const ev = envelopeView(state, c, month);
        const pct = ev.budget > 0 ? Math.min(100, (ev.spent / ev.budget) * 100) : 100;
        const src = wName(c.sourceWalletId);
        const over = ev.remaining < 0;
        return (
          <div key={c.id} role="button" tabIndex={0} onClick={() => onOpen(c.id)} onKeyDown={(e) => e.key === 'Enter' && onOpen(c.id)}
            className="card relative flex cursor-pointer flex-col gap-1.5 overflow-hidden p-2.5 text-left active:scale-[.98]">
            <span className="absolute inset-x-0 top-0 h-1" style={{ background: groupColor(c) }} />
            <span className="flex items-center gap-2">
              <Glyph icon={c.icon} logo={c.logo} label={c.name} size={30} />
              <span className="min-w-0 flex-1 truncate text-[12.5px] font-bold leading-tight">{c.name}</span>
            </span>
            <span>
              <span className="block text-[10.5px] text-muted">{over ? 'Dépassé de' : 'Reste'}</span>
              <span className={cx('num block whitespace-nowrap text-[17px] font-extrabold leading-tight', over && 'text-danger')}>
                {fmt(Math.abs(ev.remaining))}<span className="ml-0.5 text-[0.6em] opacity-60">XOF</span>
              </span>
            </span>
            <Bar pct={pct} color={over ? '#D64545' : groupColor(c)} h={5} />
            <span className="num block truncate text-[10.5px] text-muted">{fmt(ev.spent)} / {fmt(ev.budget)}</span>
            <span className="flex items-center gap-1.5">
              {src ? <Glyph icon={src.icon} logo={src.logo} label={src.name} size={16} /> : null}
              <span className="min-w-0 flex-1 truncate text-[10.5px] text-muted">
                {ev.funded > 0 ? `${fmt(ev.funded)} approvisionné` : src ? src.name : 'À approvisionner'}
              </span>
              {ev.toFund > 0 && (
                <button onClick={(e) => { e.stopPropagation(); onFund(c.id); }} className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-primary text-onprimary" aria-label={`Approvisionner ${c.name}`}>
                  <LuPlus size={14} strokeWidth={3} />
                </button>
              )}
              {ev.toFund === 0 && ev.funded > 0 && <LuCheck size={14} className="shrink-0 text-ok" />}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Évolution mois par mois (budget, dépensé, reste)
// ---------------------------------------------------------------------
export function Evolution({ state, month, categoryId, title = 'Mois par mois' }: { state: State; month: string; categoryId?: string; title?: string }) {
  const data = useMemo(() => monthlyEvolution(state, shiftMonth(month, -4), 6, categoryId), [state, month, categoryId]);
  const max = Math.max(1, ...data.map((d) => Math.max(d.budget, d.spent)));
  const cur = monthKey(new Date());
  return (
    <section className="card p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="text-[14px] font-bold">{title}</h3>
        <span className="flex items-center gap-2 text-[10.5px] text-muted">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary/25" />Budget</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-primary" />Dépensé</span>
        </span>
      </div>
      <div className="mt-2 flex h-28 items-end gap-2 px-1">
        {data.map((d) => {
          const [, mm] = d.month.split('-').map(Number);
          return (
            <div key={d.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`${d.month} : budget ${fmt(d.budget)}, dépensé ${fmt(d.spent)}`}>
              <div className="relative w-full flex-1">
                <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-primary/20" style={{ height: `${(d.budget / max) * 100}%` }} />
                <div className={cx('absolute inset-x-1.5 bottom-0 rounded-t-md', d.spent > d.budget ? 'bg-danger' : 'bg-primary')} style={{ height: `${(d.spent / max) * 100}%` }} />
              </div>
              <span className={cx('text-[10px]', d.month === cur ? 'font-bold text-primary' : 'text-muted')}>{MONTHS_FR[mm - 1]}</span>
            </div>
          );
        })}
      </div>
      <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto">
        {data.map((d) => (
          <span key={d.month} className="shrink-0 rounded-lg bg-surface2 px-2 py-1 text-[10.5px]">
            <span className="text-muted">{MONTHS_FR[Number(d.month.slice(5)) - 1]} reste </span>
            <b className={cx('num', d.remaining < 0 && 'text-danger')}>{fmt(d.remaining)}</b>
          </span>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------
// Prévoir une dépense sur une date (apparaît dans « À régler », avec rappel)
// ---------------------------------------------------------------------
export function PlanSheet({ date, onClose, store, onDone }: { date: string | null; onClose: () => void; store: Store; onDone: (m: string) => void }) {
  const cats = store.state.categories.filter((c) => !c.hidden);
  const [cat, setCat] = useState('');
  const [amount, setAmount] = useState(0);
  const [wallet, setWallet] = useState('w_cash');
  const [note, setNote] = useState('');
  const [d, setD] = useState('');
  useEffect(() => {
    if (!date) return;
    setD(date); setAmount(0); setNote('');
    const first = cats[0];
    setCat(first?.id ?? ''); setWallet(first?.sourceWalletId ?? bestWallet(store.state, date.slice(0, 7)));
  }, [date]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!date) return null;
  const c = cats.find((x) => x.id === cat);
  const month = d.slice(0, 7);
  const short = envelopeShortfall(store.state, cat, amount, month);
  const save = () => {
    if (!c || amount <= 0) return;
    store.setAll((s) => ({ ...s, planned: [...(s.planned ?? []), { id: uid('p'), date: d, categoryId: c.id, amount, walletId: wallet, note: note.trim() || undefined }] }));
    onDone(`${note.trim() || c.name} prévu le ${new Date(d + 'T12:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`);
  };
  return (
    <Sheet open onClose={onClose} title="Prévoir une dépense"
      footer={<div className="pb-1"><Btn className="w-full" onClick={save} disabled={!c || amount <= 0}><LuCheck /> Prévoir {amount ? fmtN(amount) + ' XOF' : ''}</Btn></div>}>
      <div className="num py-1 text-center text-[36px] font-extrabold">{fmtN(amount)} XOF</div>
      <Keypad value={amount} onChange={setAmount} />
      <Label>Enveloppe</Label>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {cats.map((x) => (
          <button key={x.id} onClick={() => { setCat(x.id); if (x.sourceWalletId) setWallet(x.sourceWalletId); }} className={cx('flex w-[72px] shrink-0 flex-col items-center gap-1 rounded-2xl border px-1 py-2', cat === x.id ? 'border-primary bg-primary/10' : 'border-transparent')}>
            <Glyph icon={x.icon} logo={x.logo} label={x.name} size={36} />
            <span className="w-full truncate text-center text-[10.5px] font-semibold">{x.name}</span>
          </button>
        ))}
      </div>
      {short && <p className="mt-1 rounded-xl bg-warn/10 px-2.5 py-2 text-[12px]">Il ne reste que {fmt(Math.max(0, short.left))} XOF dans « {c?.name} » ce mois : au moment de payer, je te proposerai de compléter depuis un compte.</p>}
      <Label>Payé avec (prévu)</Label>
      <WalletFreePicker store={store} value={wallet} onChange={setWallet} month={month} />
      <div className="grid grid-cols-2 gap-2">
        <div><Label>Date</Label><input type="date" value={d} onChange={(e) => setD(e.target.value || d)} className="w-full rounded-2xl border border-line bg-surface px-3 py-2.5 text-[14px]" /></div>
        <div><Label>Pour quoi</Label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ex : Anniversaire" className="w-full rounded-2xl border border-line bg-surface px-3 py-2.5 text-[14px]" /></div>
      </div>
      <p className="mt-2 text-[11.5px] text-muted">Elle apparaîtra dans « À régler » et dans le calendrier, avec un rappel si les rappels sont activés.</p>
    </Sheet>
  );
}
