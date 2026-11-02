import { useMemo, useState } from 'react';
import { LuChevronLeft, LuChevronRight, LuSearch, LuPlus } from 'react-icons/lu';
import type { MonthReport, State, Tx } from '../engine';
import { daysIn, fmt, fromISO, monthDues, pad, shiftMonth, toISODate } from '../engine';
import { Empty, Money, Segmented, cx, inputCls } from '../ui';
import { Glyph } from '../icons';

const WD = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

export function TxRow({ t, state, onClick }: { t: Tx; state: State; onClick?: () => void }) {
  const cat = state.categories.find((c) => c.id === t.categoryId) ?? state.incomeCategories.find((c) => c.id === t.categoryId);
  const w = (id?: string) => state.wallets.find((x) => x.id === id);
  const title = t.note || cat?.name || (t.type === 'transfer' ? 'Transfert' : 'Opération');
  const sub =
    t.type === 'transfer'
      ? `${w(t.fromWalletId)?.name} → ${w(t.toWalletId)?.name}`
      : `${cat?.name ?? ''} · ${w(t.walletId)?.name ?? ''}`;
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-surface2">
      <Glyph icon={t.type === 'transfer' ? 'transfer' : cat?.icon ?? 'tag'} logo={t.type === 'transfer' ? undefined : cat?.logo} label={cat?.name} size={40} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-semibold">{title}</span>
        <span className="block truncate text-[11.5px] text-muted">
          {sub}{t.history?.length ? ' · modifié' : ''}
        </span>
      </span>
      <Money
        v={t.type === 'expense' ? -t.amount : t.amount}
        sign={t.type === 'income'}
        className={cx('text-[14px] font-bold', t.type === 'income' ? 'text-ok' : t.type === 'transfer' ? 'text-muted' : 'text-ink')}
      />
    </button>
  );
}

export function CalendarScreen({
  state, r, month, setMonth, onEdit, onAdd,
}: {
  state: State; r: MonthReport; month: string; setMonth: (m: string) => void; onEdit: (t: Tx) => void; onAdd: (date: string) => void;
}) {
  const today = toISODate(new Date());
  const [sel, setSel] = useState(() => (today.startsWith(month) ? today : `${month}-01`));
  const [view, setView] = useState<'month' | 'list'>('month');
  const [q, setQ] = useState('');
  const dim = daysIn(month);
  const [y, m] = month.split('-').map(Number);
  const offset = (new Date(y, m - 1, 1).getDay() + 6) % 7;
  // Budget journalier indicatif : enveloppes courantes réparties sur le mois.
  const dailyRef = r.flexBudget / dim;

  const byDay = useMemo(() => {
    const map = new Map<string, Tx[]>();
    for (const t of state.txs) if (t.date.startsWith(month)) map.set(t.date, [...(map.get(t.date) ?? []), t]);
    return map;
  }, [state.txs, month]);

  const go = (d: number) => {
    const nm = shiftMonth(month, d);
    setMonth(nm);
    setSel(today.startsWith(nm) ? today : `${nm}-01`);
  };

  const dues = useMemo(() => monthDues(state, r), [state, r]);
  const dueByDay = (d: number) => dues.filter((x) => x.day === d);
  const base = Math.max(r.incomeReceived, r.expectedIncome, 1);
  const upcoming = dues.filter((d) => !d.paid && d.day >= (today.startsWith(month) ? Number(today.slice(8)) : 1)).filter((d, i, a) => a.findIndex((x) => x.categoryId === d.categoryId) === i).slice(0, 10);
  const dayTx = byDay.get(sel) ?? [];
  const selDay = Number(sel.slice(8));
  const daySpent = r.dailySpend[selDay - 1] ?? 0;
  const dayAll = dayTx.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0);
  const dayIn = dayTx.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0);
  // Semaine (lundi → dimanche) contenant le jour sélectionné
  const wStart = Math.max(1, selDay - ((new Date(y, m - 1, selDay).getDay() + 6) % 7));
  const wEnd = Math.min(dim, wStart + 6);
  const weekSpent = r.dailySpend.slice(wStart - 1, wEnd).reduce((a, b) => a + b, 0);
  const weekBudget = dailyRef * (wEnd - wStart + 1);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return [...state.txs]
      .filter((t) => t.date.startsWith(month))
      .filter((t) => {
        if (!ql) return true;
        const cat = state.categories.find((c) => c.id === t.categoryId)?.name ?? '';
        return `${t.note ?? ''} ${cat} ${t.amount}`.toLowerCase().includes(ql);
      })
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }, [state.txs, state.categories, month, q]);

  const monthLabel = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <button onClick={() => go(-1)} className="grid h-10 w-10 place-items-center rounded-2xl bg-surface2" aria-label="Mois précédent"><LuChevronLeft /></button>
        <div className="text-center">
          <div className="text-[17px] font-bold capitalize">{monthLabel}</div>
          <div className="text-[11.5px] text-muted">Dépensé <b className="text-ink">{fmt(r.spent)} XOF</b> · repère {fmt(dailyRef)} XOF/j</div>
        </div>
        <button onClick={() => go(1)} className="grid h-10 w-10 place-items-center rounded-2xl bg-surface2" aria-label="Mois suivant"><LuChevronRight /></button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="card px-3 py-2"><div className="text-[11px] text-muted">Dépensé</div><div className="num text-[17px] font-extrabold">{fmt(r.spent)} XOF <span className="text-[12px] font-semibold text-muted">{Math.round((r.spent / base) * 100)} %</span></div></div>
        <div className="card px-3 py-2"><div className="text-[11px] text-muted">Épargne</div><div className="num text-[17px] font-extrabold text-primary">{fmt(r.savingsDone)} XOF <span className="text-[12px] font-semibold text-muted">{Math.round((r.savingsDone / base) * 100)} %</span></div></div>
      </div>

      <Segmented value={view} onChange={setView} small options={[{ value: 'month', label: 'Calendrier' }, { value: 'list', label: 'Chronologie' }]} />

      {view === 'month' ? (
        <>
          <div className="card p-3">
            <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold text-muted">{WD.map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: offset }).map((_, i) => <span key={'e' + i} />)}
              {Array.from({ length: dim }).map((_, i) => {
                const day = i + 1;
                const key = `${month}-${pad(day)}`;
                const s = r.dailySpend[i];
                const has = (byDay.get(key) ?? []).length > 0;
                const oblig = (byDay.get(key) ?? []).some((t) => state.categories.find((c) => c.id === t.categoryId)?.kind === 'obligatory');
                const tone = !has || s === 0 ? null : s <= dailyRef ? 'var(--s-primary)' : s <= dailyRef * 1.6 ? '#E09328' : '#D64545';
                return (
                  <button
                    key={day}
                    onClick={() => setSel(key)}
                    className={cx(
                      'relative flex h-12 flex-col items-center justify-center rounded-xl text-[13px] transition',
                      sel === key ? 'ring-2 ring-primary' : '',
                      key === today && 'font-extrabold',
                    )}
                    style={{ background: tone ? `color-mix(in srgb, ${tone} 14%, var(--s-surface))` : 'var(--s-surface2)', color: tone ?? undefined }}
                  >
                    <span className={cx(!tone && 'text-muted')}>{day}</span>
                    {s > 0 && <span className="num text-[9px] font-bold leading-none">{s >= 1000 ? Math.round(s / 1000) + 'k' : s}</span>}
                    {dueByDay(day).length > 0 && (
                      <span className="absolute -right-0.5 -top-1 flex">
                        {dueByDay(day).slice(0, 2).map((d) => (
                          <span key={d.categoryId} className="grid h-4 w-4 place-items-center rounded-[5px] text-white ring-1 ring-[var(--s-surface)]" style={{ background: d.paid ? 'var(--s-muted)' : d.color }}>
                            <Glyph icon={d.icon} label={d.name} size={16} plain />
                          </span>
                        ))}
                      </span>
                    )}
                    {oblig && !dueByDay(day).length && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-ink/60" />}
                  </button>
                );
              })}
            </div>
            <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10.5px] text-muted">
              <Legend c="var(--s-primary)" t="Dans le repère" /><Legend c="#E09328" t="Élevé" /><Legend c="#D64545" t="Dépassé" /><Legend c="var(--s-ink)" t="Obligation payée" />
            </div>
          </div>

          <div className="card p-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-[15px] font-bold capitalize">
                {fromISO(sel).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
              </h3>
              <button onClick={() => onAdd(sel)} className="flex items-center gap-1 rounded-xl bg-surface2 px-2.5 py-1.5 text-xs font-bold text-primary"><LuPlus size={14} /> Ajouter</button>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              <Mini label="Dépensé" v={dayAll} />
              <Mini label="Encaissé" v={dayIn} tone="text-ok" />
              <Mini label="Repère jour" v={dailyRef} sub={daySpent > dailyRef ? 'dépassé' : undefined} />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 text-center">
              <Mini label="Reste semaine" v={weekBudget - weekSpent} />
              <Mini label="Reste du mois" v={r.flexRemaining} />
            </div>
            {dueByDay(selDay).map((d) => (
              <div key={d.categoryId} className="mt-2 flex items-center gap-3 rounded-2xl px-2 py-2" style={{ background: `color-mix(in srgb, ${d.color} 10%, var(--s-surface))` }}>
                <span className="grid h-9 w-9 place-items-center rounded-xl text-white" style={{ background: d.color }}><Glyph icon={d.icon} label={d.name} size={36} plain /></span>
                <span className="flex-1 text-[13.5px] font-semibold">{d.name}<span className="block text-[11.5px] font-normal text-muted">{d.paid ? 'Payé ce mois ✓' : 'Échéance du jour'}</span></span>
                <b className="num text-[14px]">{fmt(d.amount)} XOF</b>
              </div>
            ))}
            <div className="mt-2">
              {dayTx.length ? dayTx.map((t) => <TxRow key={t.id} t={t} state={state} onClick={() => onEdit(t)} />) : <Empty>Journée calme : aucune opération.</Empty>}
            </div>
          </div>
          {upcoming.length > 0 && (
            <div className="card p-3">
              <h3 className="px-1 pb-1 text-[14px] font-bold">À venir ce mois</h3>
              {upcoming.map((d) => (
                <div key={d.categoryId} className="flex items-center gap-3 border-t border-line px-1 py-2 first-of-type:border-0">
                  <span className="grid h-8 w-8 place-items-center rounded-lg text-white" style={{ background: d.color }}><Glyph icon={d.icon} label={d.name} size={32} plain /></span>
                  <span className="flex-1 text-[13.5px] font-semibold">{d.name}</span>
                  <span className="text-[12px] text-muted">le {d.day}</span>
                  <b className="num w-24 text-right text-[13.5px]">{fmt(d.amount)} XOF</b>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="card p-3">
          <div className="relative mb-2">
            <LuSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher : garba, CIE, 5000…" className={cx(inputCls, 'pl-10')} />
          </div>
          {list.length === 0 && <Empty>Aucune opération trouvée.</Empty>}
          {list.map((t, i) => (
            <div key={t.id}>
              {(i === 0 || list[i - 1].date !== t.date) && (
                <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-muted">
                  {fromISO(t.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </div>
              )}
              <TxRow t={t} state={state} onClick={() => onEdit(t)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Legend({ c, t }: { c: string; t: string }) {
  return <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: c }} />{t}</span>;
}
function Mini({ label, v, tone, sub }: { label: string; v: number; tone?: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface2 px-2 py-2">
      <div className="text-[10.5px] text-muted">{label}</div>
      <Money v={v} className={cx('text-[14px] font-bold', tone, v < 0 && 'text-danger')} />
      {sub && <div className="text-[10px] font-semibold text-danger">{sub}</div>}
    </div>
  );
}
