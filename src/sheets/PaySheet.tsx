// « ✓ Payé » : marquer en 2 gestes une dépense prévue comme réglée, avec justificatif si besoin.
import { useEffect, useRef, useState } from 'react';
import { LuCamera, LuCheck, LuDownload, LuFileText, LuLock, LuPaperclip, LuTrash2, LuX } from 'react-icons/lu';
import type { Attachment, Tx } from '../engine';
import { envelopeShortfall, fmt, fmtN, fromISO, lockCheck, planKey, toISODate, topUpEnvelope } from '../engine';
import { TopUpPanel, type TopUp } from './Envelope';
import { uid } from '../store';
import type { Store } from '../store';
import { Btn, Label, Money, Sheet, cx, inputCls } from '../ui';
import { Glyph } from '../icons';
import { addAttachment, fileSize, getAttachment, removeAttachment } from '../services/files';
import { isNative, saveFile } from '../services/native';
import { useBackHandler } from '../services/back';

export interface PayTarget { categoryId: string; date: string; amount: number; key?: string; walletId?: string; note?: string }

export const dateLabel = (date: string, today = toISODate(new Date())) => {
  if (date === today) return 'Aujourd’hui';
  const d = fromISO(date);
  const diff = Math.round((d.getTime() - fromISO(today).getTime()) / 864e5);
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  const txt = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '');
  return diff < 0 ? `En retard · ${txt}` : txt;
};

/** Portefeuille habituel pour une catégorie : celui de la dernière dépense. */
export const usualWallet = (store: Store, categoryId: string) =>
  [...store.state.txs].reverse().find((t) => t.type === 'expense' && t.categoryId === categoryId)?.walletId
  ?? [...store.state.txs].reverse().find((t) => t.type === 'expense')?.walletId ?? 'w_cash';

export function PaySheet({
  target, onClose, store, onDone, onUnlock,
}: { target: PayTarget | null; onClose: () => void; store: Store; onDone: (msg: string, ids: string[]) => void; onUnlock: (goalId: string) => void }) {
  const [amount, setAmount] = useState(0);
  const [wallet, setWallet] = useState('w_cash');
  const [date, setDate] = useState(toISODate(new Date()));
  const [note, setNote] = useState('');
  const [files, setFiles] = useState<Attachment[]>([]);
  const [more, setMore] = useState(false);
  const [topUp, setTopUp] = useState<TopUp>({ on: true, walletId: 'w_cash' });
  useEffect(() => {
    if (!target) return;
    setAmount(target.amount);
    const w = target.walletId ?? store.state.categories.find((c) => c.id === target.categoryId)?.sourceWalletId ?? usualWallet(store, target.categoryId);
    setWallet(w);
    setTopUp({ on: true, walletId: w });
    const today = toISODate(new Date());
    setDate(target.date < today ? target.date : today);
    setNote(target.note ?? ''); setFiles([]); setMore(false);
  }, [target]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!target) return null;
  const cat = store.state.categories.find((c) => c.id === target.categoryId);
  if (!cat) return null;
  const blocked = lockCheck(store.state, wallet, amount);
  const key = target.key ?? planKey(target.categoryId, target.date);

  const pay = () => {
    if (amount <= 0 || blocked) return;
    const short = envelopeShortfall(store.state, cat.id, amount, date.slice(0, 7));
    if (short && topUp.on) store.setAll((s) => topUpEnvelope(s, cat.id, topUp.walletId, short.missing, date, uid('f')));
    const id = store.addTx({ type: 'expense', amount, date, categoryId: cat.id, walletId: wallet, note: note || undefined, planKey: key, attachments: files.length ? files : undefined });
    onDone(`${cat.name} : ${fmt(amount)} XOF payé ✓`, [id]);
  };
  const skip = () => {
    store.setAll((s) => ({ ...s, skipped: [...(s.skipped ?? []), key].slice(-2000) }));
    onDone(`${cat.name} : sauté pour cette fois`, []);
  };
  const close = () => { files.forEach((f) => removeAttachment(f)); onClose(); };

  return (
    <Sheet open onClose={close} title="Marquer comme payé"
      footer={
        <div className="pb-1">
          <Btn className="w-full !py-3.5 text-[16px]" onClick={pay} disabled={amount <= 0 || !!blocked}>
            <LuCheck size={20} /> C’est payé · {fmtN(amount)} XOF
          </Btn>
          <button onClick={skip} className="mt-1.5 w-full py-1.5 text-[12.5px] font-semibold text-muted">Pas cette fois (sauter cette échéance)</button>
        </div>
      }>
      <div className="flex items-center gap-3 rounded-2xl bg-surface2 p-3">
        <Glyph icon={cat.icon} logo={cat.logo} label={cat.name} size={52} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[16px] font-bold">{cat.name}</div>
          <div className="text-[12px] text-muted">Prévu {dateLabel(target.date).toLowerCase()} · {fmt(target.amount)} XOF</div>
        </div>
      </div>

      <Label>Montant payé (XOF)</Label>
      <input inputMode="numeric" value={amount ? fmtN(amount) : ''} onChange={(e) => setAmount(Number(e.target.value.replace(/\D/g, '').slice(0, 9)) || 0)}
        className={cx(inputCls, 'num text-center text-[26px] font-extrabold')} />

      <Label>Payé avec</Label>
      <WalletRow store={store} value={wallet} onChange={(w) => { setWallet(w); setTopUp((t) => ({ ...t, walletId: w })); }} />
      {blocked && <LockedNotice blocked={blocked} amount={amount} onUnlock={(g) => { onClose(); onUnlock(g); }} />}
      <TopUpPanel store={store} categoryId={cat.id} amount={amount} date={date} value={topUp} onChange={setTopUp} />

      <Label>Justificatif (facultatif)</Label>
      <AttachmentsField value={files} onChange={setFiles} />

      {!more ? (
        <button onClick={() => setMore(true)} className="mt-3 text-[12.5px] font-semibold text-primary">+ Date, note</button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <div><Label>Date</Label><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} /></div>
          <div><Label>Note</Label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" className={inputCls} /></div>
        </div>
      )}
    </Sheet>
  );
}

export function WalletRow({ store, value, onChange, exclude }: { store: Store; value: string; onChange: (id: string) => void; exclude?: string }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {store.state.wallets.filter((w) => !w.hidden && w.id !== exclude).map((w) => (
        <button key={w.id} onClick={() => onChange(w.id)} className={cx('flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2', value === w.id ? 'border-primary bg-primary/10' : 'border-line bg-surface')}>
          <Glyph icon={w.icon} logo={w.logo} label={w.name} size={28} />
          <span className="text-[12.5px] font-semibold">{w.name}</span>
        </button>
      ))}
    </div>
  );
}

/** Message affiché quand une sortie d'argent toucherait l'argent bloqué pour un projet. */
export function LockedNotice({ blocked, amount, onUnlock }: { blocked: NonNullable<ReturnType<typeof lockCheck>>; amount: number; onUnlock: (goalId: string) => void }) {
  return (
    <div className="mt-2 rounded-2xl border border-warn/40 bg-warn/10 p-3 text-[12.5px]">
      <div className="flex items-center gap-1.5 font-bold"><LuLock size={15} /> Argent bloqué pour tes projets</div>
      <div className="mt-1">
        Sur ce compte : <Money v={blocked.balance} className="font-semibold" /> dont <b><Money v={blocked.locked} /></b> bloqués
        ({blocked.goals.map((g) => g.name).join(', ')}). Utilisable : <b><Money v={Math.max(0, blocked.available)} /></b>.
      </div>
      <div className="mt-1 text-muted">Pour utiliser {fmt(amount)} XOF, il manque {fmt(blocked.missing)} XOF : choisis un autre compte ou débloque l’argent dans le projet.</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {blocked.goals.map((g) => (
          <button key={g.goalId} onClick={() => onUnlock(g.goalId)} className="rounded-xl bg-ink px-2.5 py-1.5 text-[12px] font-bold text-bg">Débloquer « {g.name} »</button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Justificatifs : prendre en photo, joindre un fichier, voir, télécharger
// ---------------------------------------------------------------------
export function AttachmentsField({ value, onChange, keepOnRemove }: { value: Attachment[]; onChange: (a: Attachment[]) => void; keepOnRemove?: boolean }) {
  const cam = useRef<HTMLInputElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState<Attachment | null>(null);
  const add = async (f?: File) => {
    if (!f) return;
    setErr('');
    try { onChange([...value, await addAttachment(f)]); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      {value.map((a) => (
        <div key={a.id} className="mb-1.5 flex items-center gap-2 rounded-2xl bg-surface2 px-2.5 py-2">
          <button onClick={() => setView(a)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <Thumb a={a} />
            <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{a.name}</span><span className="text-[11px] text-muted">{fileSize(a.size)} · toucher pour voir</span></span>
          </button>
          <button onClick={() => { if (!keepOnRemove) removeAttachment(a); onChange(value.filter((x) => x.id !== a.id)); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted" aria-label="Retirer"><LuTrash2 size={16} /></button>
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        <Btn variant="ghost" onClick={() => cam.current?.click()}><LuCamera /> Photo</Btn>
        <Btn variant="ghost" onClick={() => file.current?.click()}><LuPaperclip /> Fichier / PDF</Btn>
      </div>
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { add(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={file} type="file" accept="image/*,application/pdf" hidden onChange={(e) => { add(e.target.files?.[0]); e.target.value = ''; }} />
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
      <AttachmentViewer a={view} onClose={() => setView(null)} />
    </>
  );
}

function Thumb({ a }: { a: Attachment }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!a.mime.startsWith('image/')) return;
    let u = '';
    getAttachment(a).then((b) => { if (b) { u = URL.createObjectURL(b); setUrl(u); } });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [a.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return url
    ? <img src={url} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" />
    : <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-surface text-primary"><LuFileText size={20} /></span>;
}

/** Plein écran : aperçu + télécharger / partager. */
export function AttachmentViewer({ a, onClose }: { a: Attachment | null; onClose: () => void }) {
  const [state, setState] = useState<{ url: string; blob: Blob } | 'missing' | null>(null);
  useBackHandler(!!a, onClose);
  useEffect(() => {
    if (!a) { setState(null); return; }
    let u = '';
    getAttachment(a).then((b) => { if (b) { u = URL.createObjectURL(b); setState({ url: u, blob: b }); } else setState('missing'); });
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!a) return null;
  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black/95 text-white" role="dialog" aria-label={a.name}>
      <div className="safe-top flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{a.name}</span>
        {state && state !== 'missing' && (
          <button onClick={() => saveFile(a.name, state.blob, a.mime).catch(() => {})} className="flex items-center gap-1 rounded-xl bg-white/15 px-3 py-2 text-[13px] font-bold"><LuDownload /> Télécharger</button>
        )}
        <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/15" aria-label="Fermer"><LuX /></button>
      </div>
      <div className="flex flex-1 items-center justify-center overflow-auto p-3">
        {state === null && <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />}
        {state === 'missing' && <p className="max-w-xs text-center text-[13px] opacity-80">Fichier introuvable sur ce téléphone. Connecte-toi à Internet avec ton compte pour le récupérer depuis ta sauvegarde.</p>}
        {state && state !== 'missing' && (a.mime.startsWith('image/')
          ? <img src={state.url} alt={a.name} className="max-h-full max-w-full rounded-lg object-contain" />
          : a.mime === 'application/pdf' && isNative()
            ? (
              <div className="flex flex-col items-center gap-3 text-center">
                <LuFileText size={56} />
                <p className="text-[13px] opacity-80">Document PDF · {fileSize(a.size)}</p>
                <button onClick={() => saveFile(a.name, state.blob, a.mime).catch(() => {})} className="rounded-xl bg-white px-4 py-2.5 text-[14px] font-bold text-black">Ouvrir avec…</button>
              </div>
            )
          : a.mime === 'application/pdf'
            ? <iframe src={state.url} title={a.name} className="h-full w-full rounded-lg bg-white" />
            : <p>Aperçu indisponible.</p>)}
      </div>
    </div>
  );
}

/** Liste compacte (lecture seule) des justificatifs d'une opération. */
export function AttachmentList({ tx }: { tx: Tx }) {
  const [view, setView] = useState<Attachment | null>(null);
  if (!tx.attachments?.length) return null;
  return (
    <>
      {tx.attachments.map((a) => (
        <button key={a.id} onClick={() => setView(a)} className="mb-1.5 flex w-full items-center gap-2 rounded-2xl bg-surface2 px-2.5 py-2 text-left">
          <Thumb a={a} /><span className="min-w-0 flex-1 truncate text-[13px] font-semibold">{a.name}</span>
        </button>
      ))}
      <AttachmentViewer a={view} onClose={() => setView(null)} />
    </>
  );
}
