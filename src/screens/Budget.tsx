import { type ReactNode, useMemo, useState } from 'react';
import { LuChevronDown, LuPlus, LuSettings2, LuSparkles, LuCircleCheck, LuTriangleAlert, LuFlaskConical, LuCheck, LuWallet, LuPencil } from 'react-icons/lu';
import { EnvelopeCards, Evolution } from '../sheets/Envelope';
import type { MonthReport, State } from '../engine';
import { fmt, fmtK, groupReports, monthKey, pendingItems, periodView, shiftMonth, todayForecast, type ForecastItem, type PendingItem } from '../engine';
import { dateLabel } from '../sheets/PaySheet';
import { Bar, HEALTH, Money, STATUS_COLOR, Segmented, cx } from '../ui';
import { Glyph } from '../icons';
import { AllocRing } from '../sheets/Welcome';

const monthShort = (m: string) => {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' }).replace('.', '');
};

export function BudgetScreen({
  state, r, month, setMonth, onRebalance, onCategory, onNewCategory, onGroups, onSimulate, onPay, onFund, today, onForecast, onEditTx,
}: {
  state: State; r: MonthReport; month: string; setMonth: (m: string) => void; onRebalance: () => void;
  onCategory: (id: string) => void; onNewCategory: () => void; onGroups: () => void; onSimulate: () => void;
  onPay: (p: PendingItem) => void; onFund: (categoryId: string) => void; today: Date;
  onForecast: (action: 'yes' | 'no' | 'other' | 'undo', f: ForecastItem) => void; onEditTx: (txId: string) => void;
}) {
  const pending = useMemo(() => (month === monthKey(today) ? pendingItems(state, today, 7, true) : []), [state, month, today]);
  const forecast = useMemo(() => (month === monthKey(today) ? todayForecast(state, today) : []), [state, month, today]);
  const [showAll, setShowAll] = useState(false);
  const [view, setView] = useState<'cards' | 'groups'>('cards');
  const groupColor = useMemo(() => new Map((state.groups ?? []).map((g) => [g.id, g.color])), [state.groups]);
  const groups = useMemo(() => groupReports(state, r), [state, r]);
  const [open, setOpen] = useState<string | null>(null);
  const [mode, setMode] = useState<'plan' | 'real'>('plan');
  const base = Math.max(r.incomeReceived, r.expectedIncome, 1);
  const spentSegs = groups.filter((g) => g.id !== 'g_savings' && g.spent > 0).map((g) => ({ id: g.id, color: g.color, value: g.spent }));
  const savings = r.savingsDone;
  const over = r.overspent;
  const overTotal = over.reduce((a, c) => a + c.spent - c.budget, 0);
  const h = HEALTH[r.health];

  return (
    <div className="flex flex-col gap-3">
      {/* Mois précédent / courant / suivant */}
      <div className="-mx-4 -mt-1 flex items-end justify-center gap-6 px-4 pb-1">
        <button onClick={() => setMonth(shiftMonth(month, -1))} className="text-[13px] font-semibold capitalize text-muted">{monthShort(shiftMonth(month, -1))}</button>
        <span className="text-[20px] font-extrabold capitalize text-primary">{monthShort(month)}</span>
        <button onClick={() => setMonth(shiftMonth(month, 1))} className="text-[13px] font-semibold capitalize text-muted">{monthShort(shiftMonth(month, 1))}</button>
      </div>

      {/* Anneau : ce qui est dépensé par groupe, ce qui reste */}
      <section className="card flex items-center gap-3 p-3.5">
        <AllocRing income={base} segments={spentSegs} big={fmtK(r.resteAVivre)} unit="XOF" small="reste à vivre" size={128} stroke={13} />
        <div className="min-w-0 flex-1 space-y-2">
          <Stat label="Dépensé" value={r.spent} pct={(r.spent / base) * 100} />
          <Stat label="Épargné" value={savings} pct={(savings / base) * 100} />
          <div>
            <div className="text-[11.5px] leading-tight text-muted">Par jour, d’ici la fin du mois</div>
            <Money v={r.dailyAllowance} className="block text-[16px] font-extrabold leading-tight" />
          </div>
        </div>
      </section>

      {/* Assistant */}
      {over.length > 0 ? (
        <button onClick={onRebalance} className="card flex items-center gap-2.5 px-3 py-2.5 text-left">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface2 text-primary"><LuSparkles size={17} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-bold">{over.length === 1 ? `${over[0].name} a besoin de ${fmt(overTotal)} XOF` : `${over.length} enveloppes ont besoin de ${fmt(overTotal)} XOF`}</span>
            <span className="block truncate text-[11.5px] text-muted">Je t’aide à équilibrer, tes obligations restent protégées</span>
          </span>
          <span className="rounded-xl bg-primary px-2.5 py-1.5 text-xs font-bold text-onprimary">Ajuster</span>
        </button>
      ) : (
        <div className="card flex items-center gap-2.5 px-3 py-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-surface2" style={{ color: h.color }}>
            {r.health === 'green' ? <LuCircleCheck size={18} /> : <LuTriangleAlert size={18} />}
          </span>
          <span className="min-w-0 flex-1 text-[12.5px] leading-snug">
            {r.spent === 0 && r.incomeReceived === 0
              ? 'Tout est prêt ! Touche + pour noter ta première dépense ou ton salaire.'
              : r.health === 'green' ? 'Bravo, tes dépenses suivent le rythme du mois.' : r.healthReasons[0]}
          </span>
          <button onClick={onSimulate} className="flex shrink-0 items-center gap-1 rounded-xl bg-surface2 px-2.5 py-1.5 text-xs font-bold"><LuFlaskConical size={13} /> Et si ?</button>
        </div>
      )}

      {/* Prévision du jour : Oui / Non / Autre montant */}
      {forecast.length > 0 && (
        <section className="card p-3">
          <div className="flex items-center justify-between px-1 pb-1">
            <h3 className="text-[14px] font-bold">Prévision du jour</h3>
            <span className="text-[11.5px] text-muted">prévu <Money v={forecast.reduce((a, f) => a + f.planned, 0)} /></span>
          </div>
          {forecast.map((f) => (
            <div key={f.key} className="border-t border-line px-1 py-2 first-of-type:border-0">
              <div className="flex items-center gap-3">
                <Glyph icon={f.icon} logo={f.logo} label={f.name} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{f.name}</span>
                  <span className="block truncate text-[11.5px] text-muted">
                    {f.status === 'done' ? <span className="font-semibold text-ok">✓ Dépensé <Money v={f.spent} />{f.spent !== f.planned ? <span className="font-normal text-muted"> / {fmt(f.planned)}</span> : null}</span>
                      : f.status === 'skipped' ? 'Non dépensé aujourd’hui'
                      : <>Prévu <Money v={f.planned} /></>}
                  </span>
                </span>
                {f.status === 'done' && <button onClick={() => onEditTx(f.txIds[0])} className="shrink-0 rounded-xl bg-surface2 px-3 py-1.5 text-[12px] font-bold text-primary">Modifier</button>}
                {f.status === 'skipped' && <button onClick={() => onForecast('undo', f)} className="shrink-0 rounded-xl bg-surface2 px-3 py-1.5 text-[12px] font-bold text-muted">Annuler</button>}
              </div>
              {f.status === 'todo' && (
                <div className="mt-2 grid grid-cols-3 gap-1.5 pl-[50px]">
                  <button onClick={() => onForecast('yes', f)} className="flex items-center justify-center gap-1 rounded-xl bg-primary py-2 text-[12.5px] font-bold text-onprimary active:scale-95"><LuCheck size={15} strokeWidth={3} /> Oui</button>
                  <button onClick={() => onForecast('no', f)} className="rounded-xl bg-surface2 py-2 text-[12.5px] font-bold active:scale-95">Non</button>
                  <button onClick={() => onForecast('other', f)} className="flex items-center justify-center gap-1 rounded-xl bg-surface2 py-2 text-[12.5px] font-bold text-primary active:scale-95"><LuPencil size={13} /> Montant</button>
                </div>
              )}
            </div>
          ))}
          <p className="mt-1 px-1 text-[11px] text-muted">Dépensé ? <b>Oui</b> = le montant prévu, <b>Non</b> = rien aujourd’hui, <b>Montant</b> = un autre montant.</p>
        </section>
      )}

      {/* À régler : un geste pour dire « c'est payé » */}
      {pending.length > 0 && (
        <section className="card p-3">
          <div className="flex items-center justify-between px-1 pb-1">
            <h3 className="text-[14px] font-bold">À régler (retards et à venir)</h3>
            <span className="text-[11.5px] text-muted">{pending.length} · <Money v={pending.reduce((a, p) => a + p.amount, 0)} /></span>
          </div>
          {(showAll ? pending : pending.slice(0, 4)).map((p) => (
            <div key={p.key} className="flex items-center gap-3 border-t border-line px-1 py-2 first-of-type:border-0">
              <Glyph icon={p.icon} logo={p.logo} label={p.name} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-semibold">{p.name}</span>
                <span className={cx('block truncate text-[11.5px]', p.status === 'overdue' ? 'font-semibold text-danger' : p.status === 'today' ? 'font-semibold text-primary' : 'text-muted')}>
                  {dateLabel(p.date)} · <Money v={p.amount} />
                </span>
              </span>
              <button onClick={() => onPay(p)} className="flex shrink-0 items-center gap-1 rounded-xl bg-primary px-3 py-2 text-[12.5px] font-bold text-onprimary active:scale-95" aria-label={`${p.name} : marquer comme payé`}>
                <LuCheck size={15} strokeWidth={3} /> {p.kind === 'goal' ? 'Versé' : 'Payé'}
              </button>
            </div>
          ))}
          {pending.length > 4 && (
            <button onClick={() => setShowAll(!showAll)} className="mt-1 w-full rounded-xl bg-surface2 py-2 text-[12.5px] font-semibold text-primary">
              {showAll ? 'Réduire' : `Voir tout (${pending.length})`}
            </button>
          )}
        </section>
      )}

      {/* Enveloppes : en cartes (comme les comptes) ou par groupes */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">Mes enveloppes</h3>
        <div className="w-44"><Segmented small value={view} onChange={setView} options={[{ value: 'cards', label: 'Cartes' }, { value: 'groups', label: 'Groupes' }]} /></div>
      </div>
      {view === 'cards' && (
        <>
          <EnvelopeCards state={state} month={month} onOpen={onCategory} onFund={onFund} groupColor={(c) => groupColor.get(c.group ?? '') ?? '#A3A9B3'} />
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => onFund('')} className="card flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-bold text-primary"><LuWallet size={16} /> Approvisionner</button>
            <button onClick={onNewCategory} className="card flex items-center justify-center gap-1.5 py-2.5 text-[13px] font-semibold"><LuPlus size={16} /> Enveloppe</button>
          </div>
        </>
      )}

      {/* Groupes */}
      {view === 'groups' && <section className="card overflow-hidden">
        {groups.length === 0 && <p className="p-4 text-center text-[13px] text-muted">Aucun budget pour l’instant. Ajoute une catégorie pour commencer.</p>}
        {groups.map((g) => {
          const pct = g.budget > 0 ? (g.spent / g.budget) * 100 : g.spent > 0 ? 100 : 0;
          const isOpen = open === g.id;
          return (
            <div key={g.id} className="border-b border-line last:border-0">
              <button onClick={() => setOpen(isOpen ? null : g.id)} className="flex w-full items-center gap-3 px-3.5 py-3 text-left">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: g.color }}>
                  <Glyph icon={g.icon} size={40} plain />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-bold leading-tight">{g.name}</span>
                  <span className="mt-1.5 block"><Bar pct={pct} color={pct > 100 ? '#D64545' : g.color} h={5} /></span>
                  <span className="num mt-1 block text-[12px] text-muted">
                    <b className={cx('text-ink', g.spent > g.budget && g.budget > 0 && 'text-danger')}>{fmt(g.spent)}</b> / {fmt(g.budget)} XOF
                  </span>
                </span>
                <LuChevronDown className={cx('shrink-0 text-muted transition', isOpen && 'rotate-180')} />
              </button>
              {isOpen && (
                <div className="space-y-1 bg-surface2/50 px-3.5 pb-3 pt-1">
                  {g.cats.map((c) => (
                    <button key={c.id} onClick={() => onCategory(c.id)} className="w-full rounded-xl px-2 py-2 text-left active:bg-surface2">
                      <div className="mb-1 flex items-center gap-2 text-[13px]">
                        <Glyph icon={c.icon} logo={c.logo} label={c.name} size={24} />
                        <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                        <span className="num shrink-0 whitespace-nowrap text-[12px] text-muted"><b className="text-ink">{fmtK(c.spent)}</b> / {fmtK(c.budget)}</span>
                      </div>
                      <Bar pct={c.pct} color={c.status === 'ok' ? g.color : STATUS_COLOR[c.status]} h={4} />
                      {(() => {
                        const cat = state.categories.find((x) => x.id === c.id);
                        const pv = cat && month === monthKey(today) ? periodView(state, cat, today) : null;
                        return pv ? (
                          <div className={cx('mt-1 text-[11.5px]', pv.remaining < 0 ? 'text-danger' : 'text-muted')}>
                            {pv.label} : {fmt(pv.spent)} / {fmt(pv.allotted)} XOF · {pv.remaining >= 0 ? `reste ${fmt(pv.remaining)}` : `dépassé de ${fmt(-pv.remaining)}`}
                          </div>
                        ) : null;
                      })()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        <button onClick={onNewCategory} className="flex w-full items-center justify-center gap-1.5 border-t border-line py-3 text-[13.5px] font-bold text-primary"><LuPlus size={16} /> Ajouter une catégorie</button>
        <button onClick={onGroups} className="flex w-full items-center justify-center gap-1.5 border-t border-line py-3 text-[13.5px] font-semibold text-muted"><LuSettings2 size={15} /> Gérer mes groupes</button>
      </section>}

      <Evolution state={state} month={month} title="Mon budget mois par mois" />

      {/* Où part ton argent */}
      <section className="card p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-[15px] font-bold">Où part ton argent</h3>
          <div className="w-36"><Segmented small value={mode} onChange={setMode} options={[{ value: 'plan', label: 'Prévu' }, { value: 'real', label: 'Réel' }]} /></div>
        </div>
        <Sankey income={mode === 'plan' ? r.expectedIncome : Math.max(r.incomeReceived, r.spent + r.savingsDone)} groups={groups} mode={mode} incomeLabel={mode === 'plan' ? 'Revenu prévu' : 'Revenus'} />
      </section>
    </div>
  );
}

function Stat({ label, value, pct }: { label: string; value: number; pct: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between text-[11.5px] text-muted"><span>{label}</span><span>{Math.round(pct)} %</span></div>
      <Money v={value} className="block text-[17px] font-extrabold leading-tight" />
    </div>
  );
}

// ---------------------------------------------------------------------
// Schéma de flux : Revenu → groupes → catégories
// ---------------------------------------------------------------------
type G = ReturnType<typeof groupReports>[number];

export function Sankey({ income, groups, mode, incomeLabel }: { income: number; groups: G[]; mode: 'plan' | 'real'; incomeLabel: string }) {
  const val = (x: { budget: number; spent: number }) => (mode === 'plan' ? x.budget : x.spent);
  const gs = groups.map((g) => ({ ...g, v: val(g), cats: g.cats.filter((c) => val(c) > 0).sort((a, b) => val(b) - val(a)) })).filter((g) => g.v > 0);
  const total = gs.reduce((a, g) => a + g.v, 0);
  const free = Math.max(0, income - total);
  if (!total) return <p className="py-6 text-center text-[13px] text-muted">Rien à afficher pour ce mois.</p>;

  const W = 340, nodeW = 8, gap = 5, minRow = 15;
  const catsCount = gs.reduce((a, g) => a + g.cats.length, 0) + (free ? 1 : 0);
  const scaleTotal = total + free;
  // Hauteur proportionnelle, avec un espacement minimal pour que chaque libellé reste lisible.
  const k = Math.max(240, catsCount * 20) / scaleTotal;
  const x0 = 0, x1 = 118, x2 = 214;

  let y = gap;
  const catNodes: { id: string; name: string; v: number; y: number; h: number; color: string; gid: string }[] = [];
  for (const g of gs) {
    for (const c of g.cats) { const h = Math.max(2, val(c) * k); catNodes.push({ id: c.id, name: c.name, v: val(c), y, h, color: g.color, gid: g.id }); y += Math.max(h, minRow) + gap; }
    y += gap;
  }
  if (free) { const h = free * k; catNodes.push({ id: 'free', name: 'Non réparti', v: free, y, h, color: 'var(--s-line)', gid: 'free' }); y += Math.max(h, minRow) + gap; }
  const H = y;

  // Colonne groupes : centrés sur leurs catégories
  const groupNodes = [...gs.map((g) => ({ id: g.id, name: g.name, v: g.v, color: g.color })), ...(free ? [{ id: 'free', name: 'Libre', v: free, color: 'var(--s-line)' }] : [])].map((g) => {
    const cs = catNodes.filter((c) => c.gid === g.id);
    const top = cs[0].y, bottom = cs[cs.length - 1].y + cs[cs.length - 1].h;
    const h = g.v * k;
    return { ...g, h, y: (top + bottom) / 2 - h / 2 };
  });
  // Revenu : une seule barre, empilée
  const incH = scaleTotal * k;
  const incY = (H - incH) / 2;

  const ribbon = (xa: number, ya: number, xb: number, yb: number, h: number) => {
    const mx = (xa + xb) / 2;
    return `M${xa},${ya} C${mx},${ya} ${mx},${yb} ${xb},${yb} L${xb},${yb + h} C${mx},${yb + h} ${mx},${ya + h} ${xa},${ya + h} Z`;
  };

  let incAcc = incY;
  const out: ReactNode[] = [];
  for (const g of groupNodes) {
    out.push(<path key={'l0' + g.id} d={ribbon(x0 + nodeW, incAcc, x1, g.y, g.h)} fill={g.color} opacity={0.28} />);
    incAcc += g.h;
    let gAcc = g.y;
    for (const c of catNodes.filter((c) => c.gid === g.id)) {
      const h = c.v * k;
      out.push(<path key={'l1' + c.id} d={ribbon(x1 + nodeW, gAcc, x2, c.y, h)} fill={g.color} opacity={0.22} />);
      gAcc += h;
    }
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <svg viewBox={`-4 0 ${W + 8} ${H}`} width="100%" style={{ minWidth: 300 }} role="img" aria-label="Répartition du revenu par groupe et catégorie">
        {out}
        <rect x={x0} y={incY} width={nodeW} height={incH} rx={3} fill="var(--s-primary)" />
        <text x={x0 + nodeW + 4} y={incY - 6} fontSize="10" fill="var(--s-muted)">{incomeLabel}</text>
        <text x={x0 + nodeW + 4} y={incY + 8} fontSize="11" fontWeight="700" fill="var(--s-ink)">{fmtK(income)} XOF</text>
        {groupNodes.map((g) => (
          <g key={g.id}>
            <rect x={x1} y={g.y} width={nodeW} height={Math.max(2, g.h)} rx={3} fill={g.color} />
            <text x={x1 - 4} y={g.y + g.h / 2 + 3} fontSize="9.5" textAnchor="end" fill="var(--s-ink)" fontWeight="600">{g.name.length > 16 ? g.name.slice(0, 15) + '…' : g.name}</text>
          </g>
        ))}
        {catNodes.map((c) => (
          <g key={c.id}>
            <rect x={x2} y={c.y} width={nodeW} height={c.h} rx={2} fill={c.color} />
            <text x={x2 + nodeW + 4} y={c.y + c.h / 2 + 3} fontSize="9.5" fill="var(--s-ink)">
              {c.name.length > 13 ? c.name.slice(0, 12) + '…' : c.name} <tspan fontWeight="700">{fmtK(c.v)}</tspan>
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
