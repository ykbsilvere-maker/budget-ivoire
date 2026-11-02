import { useMemo, useState } from 'react';
import { LuDownload, LuFlaskConical, LuTrash2, LuPlus, LuCheck } from 'react-icons/lu';
import type { MonthReport, ScenarioItem, State } from '../engine';
import { computeMonth, fmt, fmtK, shiftMonth, simulate } from '../engine';
import { Bar, Btn, Money, STATUS_COLOR, Segmented, cx } from '../ui';
import { uid } from '../store';
import { Glyph } from '../icons';

// Palette sobre : nuances de la couleur principale.
const PALETTE = [100, 82, 66, 52, 40, 30].map((p) => `color-mix(in srgb, var(--s-primary) ${p}%, var(--s-surface2))`);
const KIND_LABEL = { obligatory: 'Obligatoires', adjustable: 'Nécessaires ajustables', flexible: 'Flexibles', unexpected: 'Imprévus', savings: 'Épargne' } as const;

export function AnalysisScreen({
  state, r, today, tab, setTab, onCategory, onExport, onApplyScenario,
}: {
  state: State; r: MonthReport; today: Date; tab: 'stats' | 'sim'; setTab: (t: 'stats' | 'sim') => void;
  onCategory: (id: string) => void; onExport: () => void; onApplyScenario: (items: ScenarioItem[]) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={tab}
        onChange={setTab}
        options={[{ value: 'stats', label: 'Analyse' }, { value: 'sim', label: <span className="inline-flex items-center gap-1"><LuFlaskConical size={14} /> Et si… ?</span> }]}
      />
      {tab === 'stats' ? (
        <Stats state={state} r={r} today={today} onCategory={onCategory} onExport={onExport} />
      ) : (
        <Simulator state={state} r={r} today={today} onApply={onApplyScenario} />
      )}
    </div>
  );
}

function Stats({ state, r, today, onCategory, onExport }: { state: State; r: MonthReport; today: Date; onCategory: (id: string) => void; onExport: () => void }) {
  const prev = useMemo(() => computeMonth(state, shiftMonth(r.month, -1), today), [state, r.month, today]);
  const spentCats = r.categories.filter((c) => c.spent > 0 && c.kind !== 'savings').sort((a, b) => b.spent - a.spent);
  const top = spentCats.slice(0, 6);
  const rest = spentCats.slice(6).reduce((a, c) => a + c.spent, 0);
  const slices = [...top.map((c, i) => ({ label: c.name, v: c.spent, color: PALETTE[i] })), ...(rest ? [{ label: 'Autres', v: rest, color: 'var(--s-line)' }] : [])];
  const total = slices.reduce((a, s) => a + s.v, 0) || 1;
  const fixed = r.categories.filter((c) => c.kind === 'obligatory').reduce((a, c) => a + c.spent, 0);
  const flex = r.spent - fixed;
  const avgDaily = r.dayOfMonth ? r.flexSpent / r.dayOfMonth : 0;
  const maxDay = Math.max(1, ...r.dailySpend, r.flexBudget / r.daysInMonth);
  const ref = r.flexBudget / r.daysInMonth;

  let acc = 0;
  const R = 54, C = 2 * Math.PI * R;

  const groups = (['obligatory', 'adjustable', 'flexible', 'unexpected', 'savings'] as const)
    .map((k) => ({ k, cats: r.categories.filter((c) => c.kind === k && (c.budget > 0 || c.spent > 0)) }))
    .filter((g) => g.cats.length);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Stat l="Revenus encaissés" v={r.incomeReceived} />
        <Stat l="Dépenses" v={r.spent} delta={prev.spent ? ((r.spent - prev.spent) / prev.spent) * 100 : undefined} />
        <Stat l="Épargne réalisée" v={r.savingsDone} sub={`sur ${fmtK(r.savingsPlanned)} prévus`} />
        <Stat l="Frais Mobile Money" v={r.fees} />
        <Stat l="Moyenne / jour" v={avgDaily} sub="dépenses courantes" />
        <Stat l="Prévision fin de mois" v={r.projectedEndBalance} sub="estimation, pas une certitude" />
      </div>

      <section className="card p-4">
        <h3 className="mb-3 text-[14px] font-bold">Où part l’argent</h3>
        <div className="flex items-center gap-4">
          <svg width="128" height="128" viewBox="0 0 128 128" className="shrink-0 -rotate-90">
            <circle cx="64" cy="64" r={R} fill="none" stroke="var(--s-surface2)" strokeWidth="18" />
            {slices.map((s) => {
              const len = (s.v / total) * C;
              const el = <circle key={s.label} cx="64" cy="64" r={R} fill="none" stroke={s.color} strokeWidth="18" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-acc} />;
              acc += len;
              return el;
            })}
          </svg>
          <ul className="min-w-0 flex-1 space-y-1 text-[12px]">
            {slices.map((s) => (
              <li key={s.label} className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                <b className="num">{Math.round((s.v / total) * 100)}%</b>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="text-[14px] font-bold">Dépenses courantes par jour</h3>
          <span className="text-[11px] text-muted">repère {fmtK(ref)} F/j</span>
        </div>
        <div className="relative flex h-28 items-end gap-[2px]">
          <div className="absolute inset-x-0 border-t border-dashed border-primary/60" style={{ bottom: `${(ref / maxDay) * 100}%` }} />
          {r.dailySpend.map((v, i) => (
            <div key={i} className="flex-1 rounded-t-[3px]" title={`${i + 1} : ${fmt(v)} F`}
              style={{ height: `${(v / maxDay) * 100}%`, minHeight: v ? 3 : 0, background: v > ref * 1.6 ? '#D64545' : v > ref ? '#F2A541' : 'var(--s-primary)', opacity: i + 1 > r.dayOfMonth ? 0.3 : 1 }} />
          ))}
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-muted"><span>1</span><span>{Math.round(r.daysInMonth / 2)}</span><span>{r.daysInMonth}</span></div>
      </section>

      <section className="card p-4">
        <h3 className="mb-2 text-[14px] font-bold">Revenus, dépenses et comparaison</h3>
        <Row l="Revenus encaissés" v={r.incomeReceived} max={Math.max(r.incomeReceived, r.spent + r.savingsDone)} c="var(--s-primary)" />
        <Row l="Dépenses fixes (obligations)" v={fixed} max={Math.max(r.incomeReceived, r.spent + r.savingsDone)} c="color-mix(in srgb, var(--s-primary) 65%, var(--s-surface2))" />
        <Row l="Dépenses flexibles" v={flex} max={Math.max(r.incomeReceived, r.spent + r.savingsDone)} c="color-mix(in srgb, var(--s-primary) 45%, var(--s-surface2))" />
        <Row l="Épargne" v={r.savingsDone} max={Math.max(r.incomeReceived, r.spent + r.savingsDone)} c="var(--s-muted)" />
        <div className="mt-3 rounded-2xl bg-surface2 p-3 text-[12px]">
          Mois précédent : <b className="num">{fmt(prev.spent)} F</b> dépensés
          {prev.spent > 0 && (
            <> · ce mois <b className={r.spent > prev.spent ? 'text-danger' : 'text-ok'}>{r.spent > prev.spent ? '+' : ''}{Math.round(((r.spent - prev.spent) / prev.spent) * 100)} %</b></>
          )}
          {prev.spent === 0 && <span className="text-muted"> (pas encore d’historique)</span>}
        </div>
      </section>

      <section className="card p-3">
        <h3 className="px-1 pb-1 text-[14px] font-bold">Enveloppes & budgets</h3>
        <p className="px-1 pb-2 text-[11.5px] text-muted">Touchez une enveloppe pour modifier son plafond ou son type. Le trait = temps écoulé.</p>
        {groups.map((g) => (
          <div key={g.k} className="mb-2">
            <div className="px-1 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-muted">{KIND_LABEL[g.k]}{g.k === 'obligatory' ? ' · protégées 🔒' : ''}</div>
            {g.cats.map((c) => (
              <button key={c.id} onClick={() => onCategory(c.id)} className="w-full rounded-2xl px-1.5 py-2 text-left active:bg-surface2">
                <div className="mb-1 flex items-center gap-2 text-[13px]">
                  <Glyph icon={c.icon} logo={c.logo} label={c.name} size={26} />
                  <span className="min-w-0 flex-1 truncate font-semibold">{c.name}</span>
                  <span className="num text-[12px] text-muted"><b className={cx(c.status === 'over' ? 'text-danger' : 'text-ink')}>{fmt(c.spent)}</b> / {fmt(c.budget)}</span>
                </div>
                <Bar pct={c.pct} color={STATUS_COLOR[c.status]} mark={g.k === 'obligatory' || g.k === 'savings' ? undefined : r.timePct * 100} />
                {c.status !== 'ok' && (
                  <div className={cx('mt-1 text-[11px]', c.status === 'over' ? 'text-danger' : 'text-[#B7791F]')}>
                    {c.status === 'over'
                      ? `Dépassé de ${fmt(c.spent - c.budget)} F`
                      : `${c.pct} % consommés. Au rythme actuel : ~${fmt(c.projected)} F en fin de mois.`}
                  </div>
                )}
              </button>
            ))}
          </div>
        ))}
      </section>

      <Btn variant="ghost" onClick={onExport}><LuDownload /> Exporter mes opérations (CSV)</Btn>
    </>
  );
}

function Stat({ l, v, sub, delta }: { l: string; v: number; sub?: string; delta?: number }) {
  return (
    <div className="card px-3 py-2.5">
      <div className="text-[11px] font-semibold text-muted">{l}</div>
      <Money v={v} className={cx('text-[17px] font-extrabold', v < 0 && 'text-danger')} />
      {delta !== undefined && <div className={cx('text-[10.5px] font-semibold', delta > 0 ? 'text-danger' : 'text-ok')}>{delta > 0 ? '▲' : '▼'} {Math.abs(Math.round(delta))} % vs mois dernier</div>}
      {sub && <div className="truncate text-[10.5px] text-muted">{sub}</div>}
    </div>
  );
}
function Row({ l, v, max, c }: { l: string; v: number; max: number; c: string }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex justify-between text-[12px]"><span>{l}</span><b className="num">{fmt(v)} F</b></div>
      <Bar pct={(v / Math.max(1, max)) * 100} color={c} h={8} />
    </div>
  );
}

// ---------------------------------------------------------------------
// SIMULATEUR « ET SI… ? »
// ---------------------------------------------------------------------
function Simulator({ state, r, today, onApply }: { state: State; r: MonthReport; today: Date; onApply: (items: ScenarioItem[]) => void }) {
  const [items, setItems] = useState<ScenarioItem[]>([]);
  const sim = useMemo(() => simulate(state, items, r.month, today), [state, items, r.month, today]);
  const cat = (id: string) => state.categories.find((c) => c.id === id);

  const presets: { label: string; make: () => ScenarioItem }[] = [
    { label: '+15 000 transport', make: () => ({ id: uid('s'), kind: 'expense', amount: 15000, categoryId: 'c_transport', label: 'Transport supplémentaire' }) },
    { label: 'Facture imprévue 40 000', make: () => ({ id: uid('s'), kind: 'expense', amount: 40000, categoryId: 'c_unexpected', label: 'Facture imprévue' }) },
    { label: 'Réduire sorties 10 000', make: () => ({ id: uid('s'), kind: 'cut', amount: 10000, categoryId: 'c_leisure', label: 'Réduire les sorties' }) },
    { label: 'Prime 100 000', make: () => ({ id: uid('s'), kind: 'income', amount: 100000, walletId: 'w_bank', label: 'Prime reçue' }) },
    { label: 'Banque → espèces 20 000', make: () => ({ id: uid('s'), kind: 'transfer', amount: 20000, fromWalletId: 'w_bank', toWalletId: 'w_cash', label: 'Retrait banque → espèces' }) },
    { label: 'Soutien famille 25 000', make: () => ({ id: uid('s'), kind: 'expense', amount: 25000, categoryId: 'c_family', label: 'Soutien à la famille' }) },
    { label: 'Épargner 50 000', make: () => ({ id: uid('s'), kind: 'expense', amount: 50000, categoryId: 'c_savings', walletId: 'w_bank', label: 'Mise de côté' }) },
  ];

  const rows: { l: string; a: number; b: number; good: 'up' | 'down' }[] = [
    { l: 'Reste à vivre', a: r.resteAVivre, b: sim.resteAVivre, good: 'up' },
    { l: 'Budget flexible restant', a: r.flexRemaining, b: sim.flexRemaining, good: 'up' },
    { l: 'Solde fin de mois', a: r.projectedEndBalance, b: sim.projectedEndBalance, good: 'up' },
    { l: 'Argent disponible', a: r.totalCash, b: sim.totalCash, good: 'up' },
    { l: 'Dépenses du mois', a: r.spent, b: sim.spent, good: 'down' },
  ];
  const coversOblig = sim.totalCash >= sim.obligationsRemaining;
  const changedWallets = sim.wallets.filter((w) => w.balance !== r.wallets.find((x) => x.id === w.id)?.balance);
  const changedCats = sim.categories.filter((c) => {
    const o = r.categories.find((x) => x.id === c.id);
    return o && (o.status !== c.status || o.budget !== c.budget || o.spent !== c.spent);
  });

  return (
    <>
      <section className="rounded-[var(--s-radius)] bg-surface2 p-3.5 text-[12.5px] leading-snug">
        <b>Espace de test.</b> Rien n’est enregistré : tes opérations, soldes et budgets réels ne changent pas tant que tu ne choisis pas « Appliquer ».
      </section>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {presets.map((p) => (
          <button key={p.label} onClick={() => setItems((x) => [...x, p.make()])} className="card shrink-0 px-3 py-2 text-[12.5px] font-semibold">
            <LuPlus className="mr-1 inline" size={13} />{p.label}
          </button>
        ))}
      </div>

      {items.length > 0 && (
        <section className="card p-3">
          {items.map((it) => (
            <div key={it.id} className="border-b border-line py-2 last:border-0">
              <div className="flex items-center justify-between text-[13px]">
                <span className="font-semibold">
                  {it.kind === 'income' ? '+ ' : it.kind === 'cut' ? '✂︎ ' : it.kind === 'transfer' ? '🔁 ' : '− '}
                  {it.label}
                </span>
                <button onClick={() => setItems((x) => x.filter((y) => y.id !== it.id))} className="text-muted" aria-label="Retirer"><LuTrash2 size={16} /></button>
              </div>
              <div className="mt-1 flex items-center gap-3">
                <input type="range" min={0} max={Math.max(100000, it.amount * 2)} step={1000} value={it.amount}
                  onChange={(e) => setItems((x) => x.map((y) => (y.id === it.id ? { ...y, amount: Number(e.target.value) } : y)))} className="flex-1" />
                <Money v={it.amount} className="w-24 text-right text-[13px] font-bold" />
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="card overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-surface2 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-muted">
          <span /> <span className="w-24 text-right">Actuelle</span> <span className="w-24 text-right text-primary">Simulée</span>
        </div>
        {rows.map((x) => {
          const d = x.b - x.a;
          const better = x.good === 'up' ? d > 0 : d < 0;
          return (
            <div key={x.l} className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 border-t border-line px-3 py-2.5 text-[13px]">
              <span>{x.l}</span>
              <Money v={x.a} className="w-24 text-right text-muted" />
              <span className="w-24 text-right">
                <Money v={x.b} className={cx('font-bold', x.b < 0 && 'text-danger')} />
                {d !== 0 && <span className={cx('block text-[10.5px] font-semibold', better ? 'text-ok' : 'text-danger')}>{d > 0 ? '+' : '−'}{fmt(Math.abs(d))}</span>}
              </span>
            </div>
          );
        })}
        <div className={cx('border-t border-line px-3 py-2.5 text-[12.5px] font-semibold', coversOblig ? 'text-ok' : 'text-danger')}>
          {coversOblig ? '✓ Tes obligations restantes restent couvertes.' : '✗ Tes obligations restantes ne seraient plus couvertes.'}
        </div>
      </section>

      {(changedCats.length > 0 || changedWallets.length > 0) && (
        <section className="card p-3 text-[12.5px]">
          <h4 className="mb-1 font-bold">Impacts détaillés</h4>
          {changedCats.map((c) => (
            <div key={c.id} className="flex justify-between py-0.5">
              <span>{c.name}</span>
              <span className={cx('num', c.status === 'over' ? 'text-danger' : c.status === 'watch' ? 'text-[#B7791F]' : 'text-ok')}>
                reste {fmt(c.remaining)} F
              </span>
            </div>
          ))}
          {changedWallets.map((w) => (
            <div key={w.id} className="flex justify-between py-0.5">
              <span>{w.name}</span>
              <span className="num">{fmt(r.wallets.find((x) => x.id === w.id)!.balance)} → <b>{fmt(w.balance)}</b> F</span>
            </div>
          ))}
        </section>
      )}

      {items.length > 0 && (
        <Btn onClick={() => { onApply(items); setItems([]); }}><LuCheck /> Appliquer ce scénario pour de vrai</Btn>
      )}
      {items.length === 0 && <p className="text-center text-[12.5px] text-muted">Choisis un scénario ci-dessus pour voir l’effet sur ton mois.</p>}
    </>
  );
}
