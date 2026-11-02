import { type ReactNode, useEffect } from 'react';
import { LuX } from 'react-icons/lu';
import type { Health } from './engine';
import { fmt } from './engine';

export const cx = (...c: (string | false | undefined | null)[]) => c.filter(Boolean).join(' ');

export const HEALTH: Record<Health, { label: string; color: string; soft: string }> = {
  green: { label: 'Tout va bien', color: '#19A974', soft: 'rgba(25,169,116,.14)' },
  orange: { label: 'Prudence', color: '#E09328', soft: 'rgba(242,165,65,.16)' },
  red: { label: 'Attention', color: '#D64545', soft: 'rgba(214,69,69,.14)' },
};
export const STATUS_COLOR = { ok: 'var(--s-primary)', watch: '#F2A541', over: '#D64545' } as const;

export function Money({ v, className, unit = 'XOF', sign }: { v: number; className?: string; unit?: string; sign?: boolean }) {
  return (
    <span className={cx('num whitespace-nowrap', className)}>
      {sign && v > 0 ? '+' : ''}
      {fmt(v)}
      <span className="ml-0.5 text-[0.6em] font-semibold opacity-60">{unit}</span>
    </span>
  );
}

export function Ring({
  value, size = 120, stroke = 10, color, track, inner, innerColor, children,
}: {
  value: number; size?: number; stroke?: number; color: string; track: string;
  inner?: number; innerColor?: string; children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  const r2 = r - stroke - 3;
  const c2 = 2 * Math.PI * r2;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - v)} style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
        {inner !== undefined && (
          <>
            <circle cx={size / 2} cy={size / 2} r={r2} stroke={track} strokeWidth={3} fill="none" opacity={0.7} />
            <circle
              cx={size / 2} cy={size / 2} r={r2} stroke={innerColor} strokeWidth={3} fill="none" strokeLinecap="round"
              strokeDasharray={c2} strokeDashoffset={c2 * (1 - Math.max(0, Math.min(1, inner)))}
            />
          </>
        )}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

export function Bar({ pct, color, h = 6, mark }: { pct: number; color: string; h?: number; mark?: number }) {
  return (
    <div className="relative w-full overflow-hidden rounded-full bg-surface2" style={{ height: h }}>
      <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
      {mark !== undefined && (
        <div className="absolute top-0 h-full w-[2px] bg-ink/40" style={{ left: `${Math.min(100, mark)}%` }} title="Temps écoulé du mois" />
      )}
    </div>
  );
}

export function Sheet({
  open, onClose, title, icon, children, footer, tall,
}: {
  open: boolean; onClose: () => void; title: string; icon?: ReactNode; children: ReactNode; footer?: ReactNode; tall?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="anim-fade absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cx(
          'anim-sheet relative flex w-full max-w-md flex-col rounded-t-[28px] bg-bg text-ink shadow-2xl sm:rounded-[28px]',
          tall ? 'h-[92dvh]' : 'max-h-[92dvh]',
        )}
        style={{ background: 'var(--s-bg)' }}
      >
        <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-muted/30 sm:hidden" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <h2 className="flex items-center gap-2 text-[17px] font-bold">{icon}{title}</h2>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-surface2 text-muted" aria-label="Fermer">
            <LuX size={18} />
          </button>
        </div>
        <div className="no-scrollbar flex-1 overflow-y-auto px-5 pb-4">{children}</div>
        {footer && <div className="safe-bottom border-t border-line px-5 pt-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Segmented<T extends string>({
  value, onChange, options, small,
}: { value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[]; small?: boolean }) {
  return (
    <div className="flex rounded-2xl bg-surface2 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-xl font-semibold transition',
            small ? 'py-1.5 text-xs' : 'py-2 text-sm',
            value === o.value ? 'bg-surface text-ink shadow-sm' : 'text-muted',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Btn({
  children, onClick, variant = 'primary', className, type = 'button', disabled,
}: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'soft' | 'danger';
  className?: string; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  const styles = {
    primary: 'text-onprimary shadow-md',
    ghost: 'border border-line text-ink bg-surface',
    soft: 'bg-surface2 text-ink',
    danger: 'bg-danger/10 text-danger',
  }[variant];
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={cx('flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold transition active:scale-[.98] disabled:opacity-40', styles, className)}
      style={variant === 'primary' ? { background: 'var(--s-primary)' } : undefined}
    >
      {children}
    </button>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="mb-1.5 mt-4 text-xs font-semibold uppercase tracking-wide text-muted">{children}</div>;
}

export const inputCls =
  'w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] text-ink outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';

export function Toast({ msg, action, onAction }: { msg: string; action?: string; onAction?: () => void }) {
  return (
    <div className="anim-pop fixed inset-x-0 bottom-24 z-[60] mx-auto flex w-[calc(100%-32px)] max-w-sm items-center justify-between gap-3 rounded-2xl bg-[#172B23] px-4 py-3 text-sm text-white shadow-xl">
      <span>{msg}</span>
      {action && (
        <button onClick={onAction} className="font-bold text-[#7BE3B5]">
          {action}
        </button>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-sm text-muted">{children}</p>;
}
