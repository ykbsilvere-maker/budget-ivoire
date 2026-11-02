import { LuArrowLeftRight, LuPlus, LuShieldCheck } from 'react-icons/lu';
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
  state, r, onTransfer, onEditWallet, onAddWallet, onEdit,
}: {
  state: State; r: MonthReport; onTransfer: () => void; onEditWallet: (id: string) => void; onAddWallet: () => void; onEdit: (t: Tx) => void;
}) {
  const transfers = state.txs.filter((t) => t.type === 'transfer' && t.date.startsWith(r.month)).sort((a, b) => b.date.localeCompare(a.date));
  const daily = r.wallets.filter((w) => !w.reserved);
  const saved = r.wallets.filter((w) => w.reserved);
  return (
    <div className="flex flex-col gap-3">
      <section className="pt-1 text-center">
        <div className="text-[12px] font-semibold uppercase tracking-wider text-muted">Mon patrimoine</div>
        <Money v={r.netWorth} className="block text-[34px] font-extrabold" />
        <div className="mt-1 flex justify-center gap-2 text-[12px]">
          <span className="rounded-full bg-surface2 px-3 py-1">Disponible <b className="num">{fmt(r.totalCash)} XOF</b></span>
          <span className="rounded-full bg-surface2 px-3 py-1">Reste à vivre <b className="num">{fmt(r.resteAVivre)} XOF</b></span>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-2">
        <Btn onClick={onTransfer}><LuArrowLeftRight /> Transférer</Btn>
        <Btn variant="ghost" onClick={onAddWallet}><LuPlus /> Ajouter un compte</Btn>
      </div>

      <h3 className="mt-1 text-[13px] font-bold uppercase tracking-wide text-muted">Comptes & Mobile Money</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {daily.map((w) => <WalletCard key={w.id} w={w} color={cardColor(state, w.id)} onClick={() => onEditWallet(w.id)} />)}
      </div>

      <h3 className="mt-1 text-[13px] font-bold uppercase tracking-wide text-muted">Épargne</h3>
      <div className="grid grid-cols-2 gap-2.5">
        {saved.map((w) => <WalletCard key={w.id} w={w} color={cardColor(state, w.id)} onClick={() => onEditWallet(w.id)} />)}
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

function WalletCard({ w, color, onClick }: { w: WalletReport; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="relative flex aspect-[1.58] flex-col justify-between overflow-hidden rounded-2xl p-3 text-left text-white shadow-sm active:scale-[.98]" style={{ background: color }}>
      <span className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10" />
      <span className="flex items-center gap-2">
        <span className="overflow-hidden rounded-lg bg-white/95">
          <Glyph icon={w.icon} logo={w.logo} label={w.name} size={28} />
        </span>
        <span className="truncate text-[12.5px] font-semibold">{w.name}</span>
      </span>
      <span>
        <span className={cx('num block text-[19px] font-extrabold leading-tight', w.balance < 0 && 'text-[#FFC9C9]')}>{fmt(w.balance)} XOF</span>
        <span className="block text-[10px] opacity-75">{w.source === 'declared' ? 'Solde déclaré' : 'Synchronisé'}</span>
      </span>
    </button>
  );
}
