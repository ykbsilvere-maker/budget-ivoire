import { useMemo, useState } from 'react';
import { LuPlus, LuHandCoins, LuPencil, LuLock, LuLockOpen, LuLandmark } from 'react-icons/lu';
import type { Debt, Goal, MonthReport, State } from '../engine';
import { fmt, fmtK, goalMonthly, goalPlanned, goalSaved, heldInOf, monthsBetween, savingsTrajectory } from '../engine';
import { Bar, Btn, Empty, Segmented, cx } from '../ui';

const monthLong = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
};

export function GoalsScreen({
  state, r, onNewGoal, onEditGoal, onContribute, onUnlock, onNewDebt, onEditDebt, onPayDebt,
}: {
  state: State; r: MonthReport; onNewGoal: () => void; onEditGoal: (id: string) => void; onContribute: (id: string) => void; onUnlock: (id: string) => void;
  onNewDebt: () => void; onEditDebt: (id: string) => void; onPayDebt: (id: string) => void;
}) {
  const [tab, setTab] = useState<'goals' | 'debts' | 'path'>('goals');
  return (
    <div className="flex flex-col gap-3">
      <Segmented value={tab} onChange={setTab} options={[{ value: 'goals', label: 'Objectifs' }, { value: 'debts', label: 'Crédits' }, { value: 'path', label: 'Trajectoire' }]} />
      {tab === 'goals' && <GoalsList state={state} month={r.month} onNew={onNewGoal} onEdit={onEditGoal} onContribute={onContribute} onUnlock={onUnlock} />}
      {tab === 'debts' && <Debts debts={state.debts ?? []} onNew={onNewDebt} onEdit={onEditDebt} onPay={onPayDebt} />}
      {tab === 'path' && <Trajectory state={state} r={r} />}
    </div>
  );
}

function GoalsList({ state, month, onNew, onEdit, onContribute, onUnlock }: { state: State; month: string; onNew: () => void; onEdit: (id: string) => void; onContribute: (id: string) => void; onUnlock: (id: string) => void }) {
  const goals = state.goals ?? [];
  return (
    <>
      {goals.length === 0 && (
        <div className="card p-5 text-center">
          <div className="text-[34px]">🎯</div>
          <h3 className="mt-1 text-[16px] font-bold">Un projet en tête ?</h3>
          <p className="mt-1 text-[13px] text-muted">Voyage, moto, mariage, fonds d’urgence… Fixe un montant et une date, je te dis combien mettre de côté chaque mois.</p>
        </div>
      )}
      {goals.map((g) => <GoalCard key={g.id} g={g} state={state} month={month} onEdit={() => onEdit(g.id)} onContribute={() => onContribute(g.id)} onUnlock={() => onUnlock(g.id)} />)}
      <Btn onClick={onNew} className="mx-auto w-full"><LuPlus /> Ajouter un objectif</Btn>
    </>
  );
}

function GoalCard({ g, state, month, onEdit, onContribute, onUnlock }: { g: Goal; state: State; month: string; onEdit: () => void; onContribute: () => void; onUnlock: () => void }) {
  const saved = goalSaved(g);
  const wName = (id?: string) => state.wallets.find((w) => w.id === id)?.name ?? '';
  const held = new Map<string, number>();
  for (const c of g.contributions) held.set(heldInOf(c), (held.get(heldInOf(c)) ?? 0) + c.amount);
  const locked = [...held].filter(([, v]) => v > 0);
  const lockedTotal = locked.reduce((a, [, v]) => a + v, 0);
  const pct = Math.min(100, Math.round((saved / Math.max(1, g.target)) * 100));
  const left = Math.max(0, g.target - saved);
  const monthly = g.monthly ? goalPlanned(g, month) : goalMonthly(g, month);
  const late = monthsBetween(month, g.deadline) < 0 && left > 0;
  return (
    <section className="relative overflow-hidden rounded-[26px] text-white shadow-md" style={{ background: 'var(--s-hero)' }}>
      {g.image && <img src={g.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0" style={{ background: g.image ? 'linear-gradient(180deg, rgba(0,0,0,.15) 0%, rgba(0,0,0,.55) 100%)' : 'transparent' }} />
      <div className="relative p-5">
        <div className="flex items-start justify-between">
          <div className="text-[15px] font-semibold opacity-95">{g.name}</div>
          <button onClick={onEdit} className="grid h-8 w-8 place-items-center rounded-full bg-white/20" aria-label="Modifier"><LuPencil size={14} /></button>
        </div>
        <div className="num mt-1 text-[34px] font-extrabold leading-none">{fmt(g.target)} XOF</div>
        <div className="text-[12.5px] opacity-85">à atteindre d’ici {monthLong(g.deadline)}</div>
        {g.project && <p className="mt-2 line-clamp-3 text-[12.5px] opacity-90">{g.project}</p>}
        {g.sourceWalletId && (
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-2.5 py-1 text-[11.5px] font-semibold backdrop-blur-sm">
            <LuLandmark size={13} /> Approvisionné depuis {wName(g.sourceWalletId)}
          </div>
        )}
        <div className="num mt-8 text-center text-[44px] font-extrabold leading-none">{pct}%</div>
        <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-black/20 p-2.5 text-center backdrop-blur-sm"><div className="text-[10.5px] font-semibold uppercase tracking-wide opacity-80">Épargné</div><div className="num text-[17px] font-extrabold">{fmt(saved)} XOF</div></div>
          <div className="rounded-2xl bg-black/20 p-2.5 text-center backdrop-blur-sm"><div className="text-[10.5px] font-semibold uppercase tracking-wide opacity-80">Restant</div><div className="num text-[17px] font-extrabold">{fmt(left)} XOF</div></div>
        </div>
        <div className="mt-3 text-center text-[12.5px] opacity-90">
          {g.doneAt ? 'Projet réalisé, bravo ! 🎉' : left === 0 ? 'Objectif atteint, bravo ! 🎉' : late ? 'Date dépassée : choisis une nouvelle échéance.' : <>{g.monthly ? 'Prévu :' : '≈'} <b>{fmt(monthly)} XOF</b> par mois{g.day ? `, le ${g.day}` : ''}</>}
        </div>
        {lockedTotal > 0 && (
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-black/25 px-3 py-2 text-[12px] backdrop-blur-sm">
            <LuLock size={15} className="shrink-0" />
            <span className="min-w-0 flex-1"><b className="num">{fmt(lockedTotal)} XOF bloqués</b> sur {locked.map(([w]) => wName(w)).join(', ')} — non utilisables pour d’autres dépenses</span>
          </div>
        )}
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {left > 0 && !g.doneAt && (
            <button onClick={onContribute} className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[14px] font-bold text-[#172B23]">
              <LuHandCoins /> Ajouter de l’argent
            </button>
          )}
          {lockedTotal > 0 && (
            <button onClick={onUnlock} className="flex items-center gap-2 rounded-full bg-white/20 px-4 py-2.5 text-[14px] font-bold backdrop-blur-sm">
              <LuLockOpen /> Débloquer
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function Debts({ debts, onNew, onEdit, onPay }: { debts: Debt[]; onNew: () => void; onEdit: (id: string) => void; onPay: (id: string) => void }) {
  const owe = debts.filter((d) => d.direction === 'owe');
  const owed = debts.filter((d) => d.direction === 'owed');
  const block = (title: string, list: Debt[], hint: string) => (
    <section className="card p-3">
      <h3 className="px-1 text-[14px] font-bold">{title}</h3>
      <p className="px-1 pb-1 text-[11.5px] text-muted">{hint}</p>
      {list.length === 0 && <Empty>Rien pour l’instant.</Empty>}
      {list.map((d) => {
        const pct = Math.round((d.paid / Math.max(1, d.total)) * 100);
        return (
          <div key={d.id} className="border-t border-line px-1 py-3 first-of-type:border-0">
            <button onClick={() => onEdit(d.id)} className="w-full text-left">
              <div className="flex items-baseline justify-between">
                <span className="text-[14px] font-semibold">{d.name}</span>
                <span className="num text-[13px]"><b>{fmt(d.total - d.paid)} XOF</b><span className="text-muted"> restants</span></span>
              </div>
              <div className="mt-1.5"><Bar pct={pct} color="var(--s-primary)" h={5} /></div>
              <div className="mt-1 flex justify-between text-[11.5px] text-muted">
                <span>{pct} % {d.direction === 'owe' ? 'remboursé' : 'récupéré'}</span>
                <span>{d.monthly ? `${fmt(d.monthly)} XOF / mois${d.dueDay ? ` · le ${d.dueDay}` : ''}` : ''}</span>
              </div>
            </button>
            {d.paid < d.total && (
              <button onClick={() => onPay(d.id)} className="mt-2 rounded-xl bg-surface2 px-3 py-1.5 text-[12.5px] font-bold text-primary">
                {d.direction === 'owe' ? 'Enregistrer un remboursement' : 'J’ai reçu un paiement'}
              </button>
            )}
          </div>
        );
      })}
    </section>
  );
  return (
    <>
      {block('Ce que je dois', owe, 'Prêts, crédits, achats à crédit. Les remboursements sont comptés comme des dépenses.')}
      {block('Ce qu’on me doit', owed, 'Argent prêté à des proches. Il n’est compté que lorsqu’il est réellement rendu.')}
      <Btn onClick={onNew}><LuPlus /> Ajouter un crédit ou un prêt</Btn>
    </>
  );
}

function Trajectory({ state, r }: { state: State; r: MonthReport }) {
  const start = r.wallets.filter((w) => w.reserved).reduce((a, w) => a + w.balance, 0);
  const goalsMonthly = (state.goals ?? []).reduce((a, g) => a + (goalSaved(g) < g.target ? goalMonthly(g, r.month) : 0), 0);
  const monthly = Math.max(r.savingsPlanned, goalsMonthly);
  const pts = useMemo(() => savingsTrajectory(start, monthly, r.month, 12), [start, monthly, r.month]);
  const max = Math.max(1, ...pts.map((p) => p.value));
  const W = 320, H = 150;
  const xy = (i: number, v: number) => [12 + (i / 12) * (W - 24), H - 18 - (v / max) * (H - 36)] as const;
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${xy(i, p.value).join(',')}`).join(' ');
  const area = `${d} L${xy(12, 0)[0]},${H - 18} L${xy(0, 0)[0]},${H - 18} Z`;
  return (
    <>
      <section className="card p-4">
        <div className="text-[12px] text-muted">Dans 12 mois, au rythme prévu</div>
        <div className="num text-[28px] font-extrabold text-primary">{fmt(pts[12].value)} XOF</div>
        <div className="text-[12px] text-muted">mis de côté ({fmt(monthly)} XOF / mois, en partant de {fmt(start)} XOF)</div>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" className="mt-3">
          <path d={area} fill="var(--s-primary)" opacity={0.12} />
          <path d={d} fill="none" stroke="var(--s-primary)" strokeWidth={2.5} strokeLinecap="round" />
          {pts.filter((_, i) => i % 3 === 0).map((p) => {
            const i = pts.indexOf(p);
            const [x, y] = xy(i, p.value);
            return (
              <g key={p.month}>
                <circle cx={x} cy={y} r={3.5} fill="var(--s-primary)" />
                <text x={x} y={H - 4} fontSize="9.5" textAnchor="middle" fill="var(--s-muted)">{monthLong(p.month).replace(/ \d{4}/, '').slice(0, 4)}.</text>
                <text x={x} y={y - 8} fontSize="9.5" textAnchor="middle" fill="var(--s-ink)" fontWeight="700">{fmtK(p.value)}</text>
              </g>
            );
          })}
        </svg>
      </section>
      <section className="card p-3">
        <h3 className="px-1 pb-1 text-[14px] font-bold">Tes objectifs sur cette trajectoire</h3>
        {(state.goals ?? []).length === 0 && <Empty>Ajoute un objectif pour le voir ici.</Empty>}
        {(state.goals ?? []).map((g) => {
          const left = Math.max(0, g.target - goalSaved(g));
          const per = goalMonthly(g, r.month);
          const months = left === 0 ? 0 : monthly > 0 ? Math.ceil(left / monthly) : Infinity;
          const ok = months !== Infinity && monthsBetween(r.month, g.deadline) + 1 >= months;
          return (
            <div key={g.id} className="flex items-center justify-between border-t border-line px-1 py-2.5 text-[13px] first-of-type:border-0">
              <span className="font-semibold">{g.name}</span>
              <span className={cx('text-right text-[12px]', ok ? 'text-ok' : 'text-[#B7791F]')}>
                {left === 0 ? 'Atteint ✓' : ok ? `À l’heure (${fmt(per)} XOF/mois)` : `Prévois ${fmt(per)} XOF/mois`}
              </span>
            </div>
          );
        })}
      </section>
    </>
  );
}
