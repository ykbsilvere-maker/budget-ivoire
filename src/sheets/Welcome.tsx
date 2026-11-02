import { type ReactNode, useMemo, useState } from 'react';
import { LuArrowLeft, LuArrowRight, LuCheck, LuDelete } from 'react-icons/lu';
import type { Category, State } from '../engine';
import { fmtN, toISODate } from '../engine';
import { DEFAULT_GROUPS, SUBSCRIPTION_CHOICES, SUBSCRIPTION_ICONS } from '../data';
import type { Store } from '../store';
import { uid } from '../store';
import { APP, Logo } from '../config';
import { cx, inputCls } from '../ui';
import { Glyph, suggestIcon } from '../icons';
import { useBackHandler } from '../services/back';

// ---------------------------------------------------------------------
// Démarrage pas à pas : le revenu, puis chaque charge une par une.
// L'anneau « restant » se remplit des couleurs de chaque groupe.
// ---------------------------------------------------------------------
type Step =
  | { kind: 'income' }
  | { kind: 'cat'; id: string; due: boolean }
  | { kind: 'subs' }
  | { kind: 'sub'; name: string }
  | { kind: 'summary' }
  | { kind: 'wallets' };

const FIXED = ['c_rent', 'c_cie', 'c_sodeci'];
const AFTER_SUBS: [string, boolean][] = [
  ['c_school', true], ['c_loan', true], ['c_food', false], ['c_transport', false], ['c_phone', false], ['c_resto', false],
  ['c_clothes', false], ['c_family', false], ['c_gifts', false], ['c_unexpected', false], ['c_savings', false],
];
const SUBTITLE: Record<string, string> = {
  c_rent: 'Montant mensuel', c_cie: 'Facture moyenne par mois', c_sodeci: 'Facture moyenne par mois', c_school: 'Montant par mois',
  c_loan: 'Mensualité', c_savings: 'À mettre de côté chaque mois',
};
const groupColor = (gid?: string) => DEFAULT_GROUPS.find((g) => g.id === gid)?.color ?? '#A3A9B3';

export function Welcome({ store, onDone, onLogin }: { store: Store; onDone: () => void; onLogin?: () => void }) {
  const { state } = store;
  const [i, setI] = useState(0);
  const [income, setIncome] = useState(0);
  const [received, setReceived] = useState(false);
  const [amounts, setAmounts] = useState<Record<string, number>>({});
  const [days, setDays] = useState<Record<string, number>>({});
  const [subs, setSubs] = useState<string[]>([]);
  const [phase, setPhase] = useState<'amount' | 'day'>('amount');
  const [balances, setBalances] = useState<Record<string, number>>({});

  const steps: Step[] = useMemo(
    () => [
      { kind: 'income' },
      ...FIXED.map((id) => ({ kind: 'cat', id, due: true }) as Step),
      { kind: 'subs' },
      ...subs.map((name) => ({ kind: 'sub', name }) as Step),
      ...AFTER_SUBS.map(([id, due]) => ({ kind: 'cat', id, due }) as Step),
      { kind: 'summary' },
      { kind: 'wallets' },
    ],
    [subs],
  );
  const step = steps[i];
  const cat = (id: string) => state.categories.find((c) => c.id === id)!;
  const subKey = (name: string) => 'sub:' + name;

  // Répartition par groupe pour l'anneau
  const segments = useMemo(() => {
    const by = new Map<string, number>();
    for (const [k, v] of Object.entries(amounts)) {
      if (!v) continue;
      const gid = k.startsWith('sub:') ? 'g_subs' : cat(k)?.group ?? 'g_other';
      by.set(gid, (by.get(gid) ?? 0) + v);
    }
    return DEFAULT_GROUPS.filter((g) => by.get(g.id)).map((g) => ({ ...g, value: by.get(g.id)! }));
  }, [amounts]); // eslint-disable-line react-hooks/exhaustive-deps
  const allocated = segments.reduce((a, g) => a + g.value, 0);
  const restant = income - allocated;

  const next = () => { setPhase('amount'); setI((x) => Math.min(steps.length - 1, x + 1)); };
  const back = () => { if (phase === 'day') { setPhase('amount'); return; } setI((x) => Math.max(0, x - 1)); };
  useBackHandler(i > 0 || phase === 'day', back);

  function finish() {
    const today = toISODate(new Date());
    const usedIds = state.wallets.filter((w) => (balances[w.id] ?? 0) > 0 || w.id === 'w_cash').map((w) => w.id);
    const salaryWallet = usedIds.includes('w_bank') ? 'w_bank' : [...usedIds].sort((a, b) => (balances[b] ?? 0) - (balances[a] ?? 0))[0] ?? 'w_cash';
    const subCats: Category[] = subs
      .filter((n) => amounts[subKey(n)] > 0)
      .map((n) => ({ id: uid('c_sub'), name: n, icon: SUBSCRIPTION_ICONS[n] ?? suggestIcon(n, ''), kind: 'obligatory', budget: amounts[subKey(n)], group: 'g_subs', dueDay: days[subKey(n)] }));
    store.setAll((s: State) => ({
      ...s,
      settings: { ...s.settings, expectedIncome: income },
      categories: [
        ...s.categories.map((c) => ({ ...c, budget: amounts[c.id] ?? c.budget, dueDay: days[c.id] ?? c.dueDay })),
        ...subCats,
      ],
      wallets: s.wallets.map((w) => ({
        ...w,
        hidden: !usedIds.includes(w.id),
        initialBalance: (balances[w.id] ?? 0) - (received && w.id === salaryWallet ? income : 0),
        updatedAt: new Date().toISOString(),
      })),
      txs: received && income > 0
        ? [...s.txs, { id: uid(), type: 'income', amount: income, date: today, categoryId: 'i_salary', walletId: salaryWallet, note: 'Salaire du mois', createdAt: new Date().toISOString() }]
        : s.txs,
    }));
    onDone();
  }

  const catSteps = steps.filter((s) => s.kind === 'cat' || s.kind === 'sub');
  const doneKey = (s: Step) => (s.kind === 'cat' ? s.id : s.kind === 'sub' ? subKey(s.name) : '');

  // ------------------------------------------------------------------
  let body: ReactNode;
  let footer: ReactNode;

  if (step.kind === 'income') {
    body = (
      <div className="flex flex-col items-center text-center">
        <Logo size={44} />
        <div className="mt-3 text-[13px] font-semibold text-muted">Bienvenue sur {APP.name}</div>
        <h1 className="mt-1 text-[22px] font-extrabold leading-tight">Pour commencer,<br />inscris ton revenu du mois</h1>
        <div className="mt-5"><AllocRing income={Math.max(income, 1)} segments={[]} big={fmtN(income)} unit="XOF" small="par mois" size={190} /></div>
        {onLogin && (
          <button onClick={onLogin} className="mt-3 rounded-full bg-surface2 px-4 py-2 text-[13px] font-semibold text-primary">
            J’ai déjà un compte · me reconnecter
          </button>
        )}
        <label className="mt-3 flex items-center gap-2 text-[13px] text-muted">
          <input type="checkbox" checked={received} onChange={(e) => setReceived(e.target.checked)} className="h-4 w-4 accent-[var(--s-primary)]" />
          Je l’ai déjà reçu ce mois-ci
        </label>
      </div>
    );
    footer = (
      <>
        <Keypad value={income} onChange={setIncome} />
        <PrimaryBtn disabled={income <= 0} onClick={next}>Valider <LuArrowRight /></PrimaryBtn>
      </>
    );
  } else if (step.kind === 'cat' || step.kind === 'sub') {
    const key = doneKey(step);
    const c = step.kind === 'cat' ? cat(step.id) : undefined;
    const name = c ? c.name : (step as { name: string }).name;
    const due = step.kind === 'sub' ? true : step.due;
    const gid = c?.group ?? 'g_subs';
    const value = amounts[key] ?? 0;
    const day = days[key] ?? c?.dueDay;
    const subtitle = step.kind === 'sub' ? 'Montant mensuel' : SUBTITLE[c!.id] ?? 'Budget par mois';
    body = (
      <>
        <StepIcons steps={catSteps} current={key} amounts={amounts} state={state} />
        <div className="mt-2 flex justify-center"><AllocRing income={income} segments={segments} big={fmtN(restant)} unit="XOF" small="restant" size={150} /></div>
        <div className="card mt-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: groupColor(gid) }}>
              <Glyph icon={c?.icon} label={name} size={40} plain />
            </span>
            <div className="flex-1">
              <div className="text-[16px] font-bold leading-tight">{name}</div>
              <div className="text-[12px] text-muted">{subtitle}</div>
            </div>
            <button onClick={() => { setAmounts({ ...amounts, [key]: 0 }); next(); }} className="rounded-full bg-surface2 px-3 py-1 text-[12px] font-semibold text-muted">Passer</button>
          </div>
          <button onClick={() => setPhase('amount')} className={cx('mx-auto mt-3 block max-w-full whitespace-nowrap rounded-2xl px-4 py-2 num text-[26px] min-[380px]:text-[32px] font-extrabold', phase === 'amount' ? 'bg-surface2' : '')}
            style={{ color: value ? groupColor(gid) : 'var(--s-muted)' }}>
            {fmtN(value)} XOF
          </button>
          {due && phase === 'day' && (
            <>
              <div className="mt-3 text-center text-[13px] font-semibold text-muted">Quel jour du mois ?</div>
              <div className="mt-2 grid grid-cols-7 gap-1.5">
                {Array.from({ length: 31 }, (_, k) => k + 1).map((d) => (
                  <button key={d} onClick={() => setDays({ ...days, [key]: d })}
                    className={cx('num mx-auto grid h-8 w-8 place-items-center rounded-full text-[13px] font-semibold', day === d ? 'text-white' : 'bg-surface2 text-ink')}
                    style={day === d ? { background: groupColor(gid) } : undefined}>{d}</button>
                ))}
              </div>
            </>
          )}
          <p className="mt-3 text-center text-[11.5px] text-muted">Tu pourras modifier ce montant plus tard.</p>
        </div>
      </>
    );
    const go = () => (due && phase === 'amount' && value > 0 ? setPhase('day') : next());
    footer = phase === 'amount' ? (
      <>
        <Keypad value={value} onChange={(v) => setAmounts({ ...amounts, [key]: v })} />
        <PrimaryBtn onClick={go} color={value ? groupColor(gid) : undefined} soft={!value}>
          {value ? 'Valider' : 'Plus tard'} <LuArrowRight />
        </PrimaryBtn>
      </>
    ) : (
      <PrimaryBtn onClick={next} color={groupColor(gid)} disabled={!day}>
        {day ? `Le ${day} de chaque mois` : 'Choisis un jour'} <LuCheck />
      </PrimaryBtn>
    );
  } else if (step.kind === 'subs') {
    body = (
      <>
        <StepIcons steps={catSteps} current="subs" amounts={amounts} state={state} />
        <div className="mt-2 flex justify-center"><AllocRing income={income} segments={segments} big={fmtN(restant)} unit="XOF" small="restant" size={150} /></div>
        <div className="card mt-3 p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: groupColor('g_subs') }}>
              <Glyph icon="tv" size={40} plain />
            </span>
            <div className="flex-1">
              <div className="text-[16px] font-bold">Abonnements</div>
              <div className="text-[12px] text-muted">Touche ceux que tu paies chaque mois</div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {SUBSCRIPTION_CHOICES.map((n) => {
              const on = subs.includes(n);
              return (
                <button key={n} onClick={() => setSubs(on ? subs.filter((x) => x !== n) : [...subs, n])}
                  className={cx('flex flex-col items-center gap-1 rounded-2xl border p-2 text-[11.5px] font-semibold', on ? 'border-primary bg-primary/10' : 'border-line')}>
                  <Glyph icon={SUBSCRIPTION_ICONS[n] ?? suggestIcon(n, '')} label={n} size={34} active={on} />
                  <span className="w-full truncate">{n}</span>
                </button>
              );
            })}
          </div>
        </div>
      </>
    );
    footer = <PrimaryBtn onClick={next} soft={!subs.length}>{subs.length ? `Continuer (${subs.length})` : 'Je n’en ai pas'} <LuArrowRight /></PrimaryBtn>;
  } else if (step.kind === 'summary') {
    body = (
      <div className="text-center">
        <h1 className="pt-2 text-[22px] font-extrabold">Ton budget est prêt 🎉</h1>
        <p className="mt-1 text-[13px] text-muted">Voici comment ton revenu est réparti chaque mois.</p>
        <div className="mt-4 flex justify-center">
          <AllocRing income={income} segments={segments} big={fmtN(restant)} unit="XOF" small={restant >= 0 ? 'libre chaque mois' : 'à trouver'} size={210} stroke={22} />
        </div>
        <div className="mt-4 space-y-1.5 text-left">
          {segments.map((g) => (
            <div key={g.id} className="flex items-center gap-3 rounded-2xl bg-surface px-3 py-2" style={{ border: '1px solid var(--s-line)' }}>
              <span className="h-3 w-3 rounded-full" style={{ background: g.color }} />
              <span className="flex-1 text-[14px] font-semibold">{g.name}</span>
              <b className="num text-[14px]">{fmtN(g.value)} XOF</b>
              <span className="w-10 text-right text-[12px] text-muted">{Math.round((g.value / Math.max(1, income)) * 100)}%</span>
            </div>
          ))}
        </div>
        {restant < 0 && <p className="mt-3 text-[12.5px] text-danger">Tes charges dépassent ton revenu de {fmtN(-restant)} XOF : tu pourras ajuster dans l’onglet Budget.</p>}
      </div>
    );
    footer = <PrimaryBtn onClick={next}>Continuer <LuArrowRight /></PrimaryBtn>;
  } else {
    body = (
      <>
        <h1 className="pt-2 text-[22px] font-extrabold">Où est ton argent aujourd’hui ?</h1>
        <p className="mt-1 text-[13px] text-muted">Indique ce que tu vois sur ton téléphone ou dans ta poche. Tu peux le faire plus tard dans « Patrimoine ».</p>
        <div className="mt-4 space-y-2">
          {state.wallets.map((w) => (
            <div key={w.id} className="card flex items-center gap-3 p-2.5">
              <Glyph icon={w.icon} logo={w.logo} label={w.name} size={38} />
              <span className="flex-1 text-[13.5px] font-semibold leading-tight">{w.name}</span>
              <input inputMode="numeric" value={balances[w.id] ? fmtN(balances[w.id]) : ''} placeholder="0" aria-label={`Solde ${w.name}`}
                onChange={(e) => setBalances({ ...balances, [w.id]: Number(e.target.value.replace(/\D/g, '')) || 0 })}
                className={cx(inputCls, 'num w-[110px] px-3 py-2 text-right font-bold')} />
            </div>
          ))}
        </div>
      </>
    );
    footer = <PrimaryBtn onClick={finish}>C’est parti ! <LuCheck /></PrimaryBtn>;
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col" style={{ background: 'var(--s-bg)' }}>
      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 pt-3">
        {i > 0 ? (
          <button onClick={back} className="grid h-9 w-9 place-items-center rounded-full bg-surface2" aria-label="Retour"><LuArrowLeft /></button>
        ) : <span className="h-9 w-9" />}
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
        </div>
        <button onClick={i === 0 ? onDone : finish} className="px-1 text-[12.5px] font-semibold text-muted">{i === 0 ? 'Plus tard' : 'Terminer'}</button>
      </div>
      <div className="no-scrollbar mx-auto w-full max-w-md flex-1 overflow-y-auto px-5 pb-3 pt-2">{body}</div>
      <div className="safe-bottom mx-auto w-full max-w-md px-5 pt-1">{footer}</div>
    </div>
  );
}

// ---------------------------------------------------------------------
function PrimaryBtn({ children, onClick, disabled, color, soft }: { children: ReactNode; onClick: () => void; disabled?: boolean; color?: string; soft?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className={cx('mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-[15px] font-bold transition active:scale-[.98] disabled:opacity-40', soft ? 'bg-surface2 text-ink' : 'text-white')}
      style={soft ? undefined : { background: color ?? 'var(--s-primary)' }}>
      {children}
    </button>
  );
}

/** Clavier numérique intégré (pas besoin du clavier du téléphone). */
export function Keypad({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const press = (k: string) => {
    const s = String(value || '');
    if (k === 'del') return onChange(Number(s.slice(0, -1)) || 0);
    const next = (s + k).replace(/^0+/, '');
    if (next.length <= 9) onChange(Number(next) || 0);
  };
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '000', '0', 'del'];
  return (
    <div className="grid grid-cols-3 gap-1.5">
      {keys.map((k) => (
        <button key={k} onClick={() => press(k)} aria-label={k === 'del' ? 'Effacer' : k}
          className="num flex h-[46px] items-center justify-center rounded-xl bg-surface text-[20px] font-semibold active:bg-surface2" style={{ border: '1px solid var(--s-line)' }}>
          {k === 'del' ? <LuDelete size={20} /> : k}
        </button>
      ))}
    </div>
  );
}

/** Anneau du revenu : segments colorés par groupe, montant restant au centre. */
export function AllocRing({ income, segments, big, small, size = 160, stroke = 16, unit }: {
  income: number; segments: { id: string; color: string; value: number }[]; big: string; small: string; size?: number; stroke?: number; unit?: string;
}) {
  // Taille du chiffre adaptée à sa longueur pour toujours tenir dans l'anneau.
  const inner = size - stroke * 2 - 12;
  const fs = Math.min(size * 0.15, inner / Math.max(4, big.length * 0.62));
  const r = (size - stroke) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  const total = Math.max(income, segments.reduce((a, s) => a + s.value, 0), 1);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--s-surface2)" strokeWidth={stroke} />
        {segments.map((s) => {
          const len = (s.value / total) * C;
          const el = (
            <circle key={s.id} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke}
              strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc} style={{ transition: 'all .4s ease' }} />
          );
          acc += len;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="num whitespace-nowrap font-extrabold leading-none" style={{ fontSize: fs }}>{big}</div>
        {unit && <div className="text-[11px] font-semibold leading-tight text-muted">{unit}</div>}
        <div className="mt-0.5 px-2 text-center text-[11.5px] leading-tight text-muted">{small}</div>
      </div>
    </div>
  );
}

function StepIcons({ steps, current, amounts, state }: { steps: Step[]; current: string; amounts: Record<string, number>; state: State }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-1.5 overflow-x-auto px-5 py-1">
      {steps.map((s) => {
        const key = s.kind === 'cat' ? s.id : s.kind === 'sub' ? 'sub:' + s.name : '';
        const c = s.kind === 'cat' ? state.categories.find((x) => x.id === s.id) : undefined;
        const filled = (amounts[key] ?? 0) > 0;
        const color = groupColor(c?.group ?? 'g_subs');
        return (
          <span key={key} className={cx('shrink-0 rounded-[10px]', key === current && 'ring-2 ring-offset-1')} style={{ ['--tw-ring-color' as string]: color }}>
            <span className="grid h-7 w-7 place-items-center rounded-[10px]" style={{ background: filled ? color : 'var(--s-surface2)', color: filled ? '#fff' : 'var(--s-muted)' }}>
              <Glyph icon={c?.icon} label={s.kind === 'sub' ? s.name : c?.name} size={28} plain />
            </span>
          </span>
        );
      })}
    </div>
  );
}
