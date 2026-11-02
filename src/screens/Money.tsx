import { LuArrowLeftRight, LuEye, LuEyeOff, LuLock, LuPlus, LuShieldCheck } from 'react-icons/lu';
import { MASK_TEXT } from '../engine';
import { isWalletHidden, isWalletMasked, maskWallet, revealWallet, useSecurity } from '../services/security';
import type { MonthReport, State, Tx, WalletReport } from '../engine';
import { fmt } from '../engine';
import { Btn, Money, cx } from '../ui';
import { TxRow } from './Calendar';
import { Glyph } from '../icons';

/** Couleurs de cartes : peu nombreuses, sobres. */
export const CARD_COLORS = ['#1F5F45', '#2B4C7E', '#7A4E2D', '#5B4B8A', '#3F4A55', '#8A6D1F'];
export const cardColor = (state: State, id: string) => {
  const w = state.wallets.find((x) => x.id === id);
  if (w?.color && CARD_COLORS.includes(w.color)) return w.color;
  const idx = Math.max(0, state.wallets.findIndex((x) => x.id === id));
  return CARD_COLORS[idx % CARD_COLORS.length];
};

export function MoneyScreen({
  state, r, onTransfer, onEditWallet, onAddWallet, onEdit, requireCode,
}: {
  state: State; r: MonthReport; onTransfer: () => void; onEditWallet: (id: string) => void; onAddWallet: () => void; onEdit: (t: Tx) => void;
  requireCode: (reason: string) => Promise<boolean>;
}) {
  useSecurity(); // se redessine quand un compte est masqué / affiché
  /** Œil d'un compte : masquer est immédiat, afficher demande le code (le compte reste masqué en permanence). */
  const eye = async (id: string, label: string) => {
    if (!isWalletMasked(id)) return maskWallet(id, true);
    if (!isWalletHidden(id)) return revealWallet(id, false);
    if (await requireCode(`Afficher ${label}`)) revealWallet(id, true);
  };
  const totalHidden = isWalletHidden('total');
  const open = async (id: string, label: string) => {
    if (isWalletHidden(id)) { if (!(await requireCode(`Afficher ${label}`))) return; revealWallet(id, true); }
    onEditWallet(id);
  };
  const transfers = state.txs.filter((t) => t.type === 'transfer' && t.date.startsWith(r.month)).sort((a, b) => b.date.localeCompare(a.date));
  const daily = r.wallets.filter((w) => !w.reserved);
  const saved = r.wallets.filter((w) => w.reserved);
  return (
    <div className="flex flex-col gap-3">
      <section className="pt-1 text-center">
        <div className="flex items-center justify-center gap-1.5 text-[12px] font-semibold uppercase tracking-wider text-muted">
          Mon patrimoine
          <EyeBtn masked={isWalletMasked('total')} hidden={totalHidden} onClick={() => eye('total', 'ton patrimoine')} />
        </div>
        <span className="num block whitespace-nowrap text-[28px] min-[380px]:text-[34px] font-extrabold">{totalHidden ? MASK_TEXT : fmt(r.netWorth)}<span className="ml-0.5 text-[0.6em] font-semibold opacity-60">XOF</span></span>
        <div className="mt-2 grid grid-cols-2 gap-2 text-left">
          <div className="rounded-2xl bg-surface2 px-3 py-2"><div className="text-[11px] text-muted">Disponible</div><span className="num block text-[15px] font-bold">{totalHidden ? MASK_TEXT : fmt(r.totalCash)}<span className="ml-0.5 text-[0.6em] opacity-60">XOF</span></span></div>
          <div className="rounded-2xl bg-surface2 px-3 py-2"><div className="text-[11px] text-muted">Reste à vivre</div><span className="num block text-[15px] font-bold">{totalHidden ? MASK_TEXT : fmt(r.resteAVivre)}<span className="ml-0.5 text-[0.6em] opacity-60">XOF</span></span></div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={onTransfer}><LuArrowLeftRight /> Transférer</Btn>
        <Btn variant="ghost" onClick={onAddWallet}><LuPlus /> Compte</Btn>
      </div>

      <h3 className="mt-1 text-[13px] font-bold uppercase tracking-wide text-muted">Comptes & Mobile Money</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {daily.map((w) => <WalletCard key={w.id} w={w} color={cardColor(state, w.id)} onClick={() => open(w.id, w.name)} onEye={() => eye(w.id, w.name)} />)}
      </div>

      <h3 className="mt-1 text-[13px] font-bold uppercase tracking-wide text-muted">Épargne</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {saved.map((w) => <WalletCard key={w.id} w={w} color={cardColor(state, w.id)} onClick={() => open(w.id, w.name)} onEye={() => eye(w.id, w.name)} />)}
        <button onClick={onAddWallet} className="flex aspect-[1.58] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line text-[12.5px] font-semibold text-muted">
          <LuPlus size={20} /> Épargne / tontine
        </button>
      </div>

      <p className="flex items-start gap-2 rounded-2xl bg-surface2 p-3 text-[12px] text-muted">
        <LuShieldCheck className="mt-0.5 shrink-0 text-primary" size={16} />
        Soldes déclarés par toi, mis à jour par tes opérations. Aucune connexion à ta banque ou à ton opérateur, aucun code PIN demandé.
      </p>

      {transfers.length > 0 && (
        <section className="card p-2">
          <h3 className="px-2 pb-1 pt-1.5 text-[13px] font-bold">Transferts du mois</h3>
          {transfers.map((t) => <TxRow key={t.id} t={t} state={state} onClick={() => onEdit(t)} />)}
        </section>
      )}
    </div>
  );
}

function EyeBtn({ masked, hidden, onClick, light }: { masked: boolean; hidden: boolean; onClick: () => void; light?: boolean }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }} aria-label={hidden ? 'Afficher (code)' : masked ? 'Re-masquer' : 'Masquer ce montant'}
      className={cx('grid h-7 w-7 shrink-0 place-items-center rounded-full', light ? 'bg-white/20 text-white' : 'bg-surface2 text-muted', masked && !hidden && 'ring-1 ring-current')}>
      {hidden ? <LuEyeOff size={14} /> : <LuEye size={14} />}
    </button>
  );
}

function WalletCard({ w, color, onClick, onEye }: { w: WalletReport; color: string; onClick: () => void; onEye: () => void }) {
  const hidden = isWalletHidden(w.id);
  const free = w.balance - w.locked - w.reservedBudget;
  return (
    <div role="button" tabIndex={0} onClick={onClick} onKeyDown={(e) => e.key === 'Enter' && onClick()}
      className="relative flex aspect-[1.45] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl p-3 text-left text-white shadow-sm active:scale-[.98]" style={{ background: color }}>
      <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <span className="relative flex items-center gap-2">
        <span className="overflow-hidden rounded-lg bg-white/95">
          <Glyph icon={w.icon} logo={w.logo} label={w.name} size={28} />
        </span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold">{w.name}</span>
        <EyeBtn masked={isWalletMasked(w.id)} hidden={hidden} onClick={onEye} light />
      </span>
      <span>
        <span className={cx('num block whitespace-nowrap text-[16px] min-[380px]:text-[19px] font-extrabold leading-tight', !hidden && w.balance < 0 && 'text-[#FFC9C9]')}>
          {hidden ? MASK_TEXT : fmt(w.balance)}<span className="ml-1 text-[0.6em] opacity-80">XOF</span>
        </span>
        {hidden ? <span className="block text-[10px] opacity-75">Masqué · code pour voir</span>
          : w.locked > 0 || w.reservedBudget > 0 ? (
            <>
              {w.reservedBudget > 0 && <span className="block truncate text-[10px] font-semibold opacity-90">Budget réservé {fmt(w.reservedBudget)}</span>}
              {w.locked > 0 && <span className="block truncate text-[10px] font-semibold opacity-90"><LuLock className="mr-0.5 inline align-[-1px]" size={10} />Projets {fmt(w.locked)}</span>}
              <span className="block truncate text-[10px] opacity-80">Libre {fmt(free)}</span>
            </>
          ) : <span className="block text-[10px] opacity-75">{w.source === 'declared' ? 'Solde déclaré' : 'Synchronisé'}</span>}
      </span>
    </div>
  );
}
