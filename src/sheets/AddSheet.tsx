import { useEffect, useMemo, useRef, useState } from 'react';
import { LuCamera, LuMic, LuRepeat, LuTriangleAlert, LuArrowDown, LuSparkles } from 'react-icons/lu';
import type { Attachment, Tx } from '../engine';
import { findDuplicate, fmt, fmtN, lockCheck, parseSentence, suggestCategory, toISODate } from '../engine';
import { AttachmentsField, LockedNotice } from './PaySheet';
import { addAttachmentFromDataUrl, removeAttachment } from '../services/files';
import type { Store } from '../store';
import { Btn, Label, Money, Segmented, Sheet, cx, inputCls } from '../ui';
import { Glyph } from '../icons';
import { analyzeReceipt, compressImage, type ReceiptResult } from '../services/receipt';

export type AddMode = 'expense' | 'income' | 'transfer';

const PAY_TO_WALLET: Record<string, string> = { cash: 'w_cash', wave: 'w_wave', orange: 'w_om', mtn: 'w_mtn', moov: 'w_moov', card: 'w_bank', bank: 'w_bank' };

export function AddSheet({
  open, onClose: close0, store, initialMode = 'expense', initialDate, autoScan, onSaved, initialAmount, initialCategory, onUnlock,
}: {
  open: boolean; onClose: () => void; store: Store; initialMode?: AddMode; initialDate?: string; autoScan?: boolean;
  initialAmount?: number; initialCategory?: string;
  onSaved: (msg: string, ids: string[]) => void; onUnlock: (goalId: string) => void;
}) {
  const { state } = store;
  const cats = state.categories.filter((c) => !c.hidden);
  const incomes = state.incomeCategories.filter((c) => !c.hidden);
  const wallets = state.wallets.filter((w) => !w.hidden);
  const lastExpense = [...state.txs].reverse().find((t) => t.type === 'expense');

  const [mode, setMode] = useState<AddMode>(initialMode);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string>(lastExpense?.categoryId ?? 'c_food');
  const [catTouched, setCatTouched] = useState(false);
  const [inc, setInc] = useState('i_salary');
  const [wallet, setWallet] = useState(lastExpense?.walletId ?? 'w_cash');
  const [toWallet, setToWallet] = useState('w_cash');
  const [fromWallet, setFromWallet] = useState('w_bank');
  const [fee, setFee] = useState('');
  const [date, setDate] = useState(initialDate ?? toISODate(new Date()));
  const [note, setNote] = useState('');
  const [dupWarn, setDupWarn] = useState<Tx | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState('');
  const [voiceMissing, setVoiceMissing] = useState<string[]>([]);
  const [voiceUnsupported, setVoiceUnsupported] = useState(false);
  const [scan, setScan] = useState<{ preview: string; busy: boolean; result?: ReceiptResult } | null>(null);
  const [files, setFiles] = useState<Attachment[]>([]);
  const [keepScan, setKeepScan] = useState(true);
  const onClose = () => { files.forEach(removeAttachment); close0(); };
  const fileRef = useRef<HTMLInputElement>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode); setAmount(initialAmount ? String(initialAmount) : ''); setNote('');
    if (initialCategory) { setCat(initialCategory); } setFee(''); setDupWarn(null); setHeard(''); setScan(null);
    setVoiceMissing([]); setFiles([]); setKeepScan(true); setCatTouched(!!initialCategory); setDate(initialDate ?? toISODate(new Date()));
    if (autoScan) setTimeout(() => fileRef.current?.click(), 150);
    else setTimeout(() => amountRef.current?.focus(), 250);
  }, [open, initialMode, initialDate, autoScan, initialAmount, initialCategory]);

  // Catégorie proposée automatiquement à partir de la note
  useEffect(() => {
    if (catTouched || !note) return;
    const s = suggestCategory(note, cats);
    if (s) setCat(s);
  }, [note]); // eslint-disable-line react-hooks/exhaustive-deps

  const recents = useMemo(() => {
    const seen = new Set<string>();
    const out: Tx[] = [];
    const kind = (id?: string) => state.categories.find((c) => c.id === id)?.kind;
    for (const t of [...state.txs].sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))) {
      if (t.type !== 'expense' || kind(t.categoryId) === 'obligatory' || kind(t.categoryId) === 'savings') continue;
      const k = `${t.categoryId}|${t.amount}|${t.note}`;
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(t);
      if (out.length >= 4) break;
    }
    return out;
  }, [state.txs]);

  const n = Number(amount.replace(/\s/g, '')) || 0;
  function computeBal(id: string) {
    const w = state.wallets.find((x) => x.id === id)!;
    return state.txs.reduce((a, t) => {
      if (t.type === 'income' && t.walletId === id) return a + t.amount;
      if (t.type === 'expense' && t.walletId === id) return a - t.amount;
      if (t.type === 'transfer') return a + (t.toWalletId === id ? t.amount : 0) - (t.fromWalletId === id ? t.amount : 0);
      return a;
    }, w.initialBalance);
  }

  const blocked = mode === 'income' ? null : lockCheck(state, mode === 'transfer' ? fromWallet : wallet, n + (Number(fee) || 0));

  async function attachments() {
    const out = [...files];
    if (scan && keepScan && mode !== 'transfer') out.push(await addAttachmentFromDataUrl(scan.preview, `recu-${date}.jpg`));
    return out.length ? out : undefined;
  }

  async function save(force = false) {
    if (n <= 0) { amountRef.current?.focus(); return; }
    if (blocked) return;
    const ids: string[] = [];
    if (mode === 'transfer') {
      if (fromWallet === toWallet) return;
      ids.push(store.addTx({ type: 'transfer', amount: n, date, fromWalletId: fromWallet, toWalletId: toWallet, note: note || undefined }));
      const f = Number(fee) || 0;
      if (f > 0) ids.push(store.addTx({ type: 'expense', amount: f, date, categoryId: 'c_fees', walletId: fromWallet, note: 'Frais de transfert' }));
      onSaved(`Transfert de ${fmt(n)} XOF enregistré`, ids);
      return;
    }
    const draft = { type: mode, amount: n, date, categoryId: mode === 'expense' ? cat : inc, note: note || undefined } as const;
    const dup = findDuplicate(state.txs, draft);
    if (dup && !force) { setDupWarn(dup); return; }
    ids.push(store.addTx({ ...draft, walletId: wallet, attachments: await attachments() }));
    const f = Number(fee) || 0;
    if (mode === 'expense' && f > 0) ids.push(store.addTx({ type: 'expense', amount: f, date, categoryId: 'c_fees', walletId: wallet, note: 'Frais de transaction' }));
    onSaved(`${mode === 'expense' ? 'Dépense' : 'Revenu'} de ${fmt(n)} XOF enregistré${mode === 'expense' ? 'e' : ''}`, ids);
  }

  function repeat(t: Tx) {
    if (lockCheck(state, t.walletId, t.amount)) { setWallet(t.walletId ?? wallet); setAmount(String(t.amount)); setCat(t.categoryId ?? cat); return; }
    const id = store.addTx({ type: 'expense', amount: t.amount, date: toISODate(new Date()), categoryId: t.categoryId, walletId: t.walletId, note: t.note });
    onSaved(`${t.note ?? 'Dépense'} · ${fmt(t.amount)} XOF répétée`, [id]);
  }

  function applySentence(text: string) {
    setHeard(text);
    const p = parseSentence(text, cats, new Date());
    if (p.amount) setAmount(String(p.amount));
    if (p.categoryId) { setCat(p.categoryId); setCatTouched(true); }
    if (p.walletId) setWallet(p.walletId);
    setDate(p.date);
    setVoiceMissing(p.missing);
    if (!note) setNote(text.length < 60 ? text.replace(/^j'?ai (dépensé|payé)\s*/i, '') : '');
  }

  function listen() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setVoiceUnsupported(true); return; }
    const rec = new SR();
    rec.lang = 'fr-FR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onresult = (e: any) => applySentence(e.results[0][0].transcript);
    rec.onerror = () => { setListening(false); setVoiceUnsupported(true); };
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    setMode('expense');
    const { base64, mediaType, preview } = await compressImage(file);
    setScan({ preview, busy: true });
    const result = await analyzeReceipt(base64, mediaType, cats.map((c) => ({ id: c.id, name: c.name })));
    setScan({ preview, busy: false, result });
    if (result.readable) {
      if (result.amount) setAmount(String(Math.round(result.amount)));
      if (result.date) setDate(result.date);
      if (result.merchant) setNote(result.merchant);
      if (result.category && cats.some((c) => c.id === result.category)) { setCat(result.category); setCatTouched(true); }
      if (result.paymentMethod && PAY_TO_WALLET[result.paymentMethod]) setWallet(PAY_TO_WALLET[result.paymentMethod]);
      if (result.fees) setFee(String(result.fees));
    }
  }

  function splitItems() {
    const items = scan?.result?.items ?? [];
    const ids = items.map((it) =>
      store.addTx({ type: 'expense', amount: Math.round(it.amount), date, walletId: wallet, note: `${note ? note + ' · ' : ''}${it.label}`, categoryId: cats.some((c) => c.id === it.category) ? it.category : cat }),
    );
    onSaved(`${ids.length} dépenses réparties enregistrées`, ids);
  }

  const title = mode === 'expense' ? 'Nouvelle dépense' : mode === 'income' ? 'Nouveau revenu' : 'Transfert entre portefeuilles';

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <div className="pb-1">
          {dupWarn && (
            <div className="mb-2 flex items-start gap-2 rounded-2xl bg-surface2 p-3 text-[12.5px]">
              <LuTriangleAlert className="mt-0.5 shrink-0 text-warn" />
              <span>Déjà noté ? Une opération de {fmt(dupWarn.amount)} XOF existe le même jour ({dupWarn.note ?? 'même catégorie'}).</span>
            </div>
          )}
          <Btn onClick={() => save(!!dupWarn)} className="w-full" disabled={n <= 0 || !!blocked || (mode === 'transfer' && fromWallet === toWallet)}>
            {dupWarn ? 'Enregistrer quand même' : mode === 'transfer' ? 'Valider le transfert réel' : `Valider ${n ? fmt(n) + ' XOF' : ''}`}
          </Btn>
        </div>
      }
    >
      <Segmented value={mode} onChange={(m) => { setMode(m); setDupWarn(null); }} small
        options={[{ value: 'expense', label: 'Dépense' }, { value: 'income', label: 'Revenu' }, { value: 'transfer', label: 'Transfert' }]} />

      {/* Montant */}
      <div className="mt-4 flex items-baseline justify-center gap-1">
        <input
          ref={amountRef}
          inputMode="numeric"
          pattern="[0-9]*"
          value={amount ? fmtN(Number(amount)) : ''}
          onChange={(e) => { setAmount(e.target.value.replace(/\D/g, '').slice(0, 9)); setDupWarn(null); }}
          placeholder="0"
          aria-label="Montant en XOF"
          className="num w-full bg-transparent text-center text-[44px] font-extrabold outline-none placeholder:text-muted/40"
        />
        <span className="text-lg font-bold text-muted">XOF</span>
      </div>
      <div className="mt-1 flex flex-wrap justify-center gap-1.5">
        {state.settings.presets.map((p) => (
          <button key={p} onClick={() => setAmount(String(p))} className={cx('rounded-xl px-3 py-1.5 text-[13px] font-semibold', n === p ? 'bg-primary text-onprimary' : 'bg-surface2')}>
            {fmt(p)}
          </button>
        ))}
      </div>

      {mode !== 'transfer' && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={listen} className="card flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold">
            <LuMic className={cx(listening && 'animate-pulse text-danger')} /> {listening ? 'J’écoute…' : 'Dicter'}
          </button>
          <button onClick={() => fileRef.current?.click()} className="card flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold">
            <LuCamera /> Scanner un reçu
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onPhoto(e.target.files?.[0] ?? undefined)} />
        </div>
      )}

      {voiceUnsupported && (
        <div className="mt-2">
          <p className="mb-1 text-[11.5px] text-muted">Dictée indisponible sur ce navigateur : écris ta phrase, je l’analyse.</p>
          <input className={inputCls} placeholder="J’ai dépensé 2 500 pour le woro-woro avec Wave"
            onKeyDown={(e) => { if (e.key === 'Enter') applySentence((e.target as HTMLInputElement).value); }}
            onBlur={(e) => e.target.value && applySentence(e.target.value)} />
        </div>
      )}
      {heard && (
        <div className="mt-2 rounded-2xl bg-surface2 p-3 text-[12.5px]">
          « {heard} »
          {voiceMissing.length > 0 && <div className="mt-1 font-semibold text-[#B7791F]">À vérifier : {voiceMissing.join(', ')}.</div>}
        </div>
      )}

      {scan && (
        <div className="mt-3 flex gap-3 rounded-2xl bg-surface2 p-3">
          <img src={scan.preview} alt="Reçu photographié" className="h-24 w-20 shrink-0 rounded-xl object-cover" />
          <div className="min-w-0 flex-1 text-[12.5px]">
            {scan.busy ? (
              <div className="flex items-center gap-2 font-semibold"><span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" /> Lecture du reçu…</div>
            ) : scan.result?.readable ? (
              <>
                <div className="flex items-center gap-1 font-bold text-primary"><LuSparkles /> Proposition à confirmer</div>
                <div>Nous avons identifié une dépense de <b>{fmt(scan.result.amount ?? 0)} XOF</b>{scan.result.merchant ? ` chez ${scan.result.merchant}` : ''}.</div>
                <div className="text-muted">Vérifie la catégorie et le moyen de paiement avant de valider.</div>
                {(scan.result.items?.length ?? 0) > 1 && (
                  <button onClick={splitItems} className="mt-1.5 rounded-xl bg-primary px-2.5 py-1 text-[12px] font-bold text-onprimary">
                    Répartir les {scan.result.items!.length} articles par catégorie
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="font-bold">Lecture automatique impossible</div>
                <div className="text-muted">{scan.result?.message ?? 'Photo peu lisible.'}</div>
                <button onClick={() => fileRef.current?.click()} className="mt-1 font-bold text-primary">Reprendre une photo</button>
              </>
            )}
            <label className="mt-1.5 flex items-center gap-1.5 text-[11.5px] font-semibold">
              <input type="checkbox" checked={keepScan} onChange={(e) => setKeepScan(e.target.checked)} className="h-4 w-4 accent-[var(--s-primary)]" />
              Garder la photo comme justificatif
            </label>
          </div>
        </div>
      )}

      {mode === 'expense' && (
        <>
          {recents.length > 0 && !scan && !heard && (
            <>
              <Label>Répéter en un geste</Label>
              <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
                {recents.map((t) => {
                  const c = cats.find((x) => x.id === t.categoryId);
                  return (
                    <button key={t.id} onClick={() => repeat(t)} className="card flex shrink-0 items-center gap-1.5 px-3 py-2 text-[12.5px]">
                      <LuRepeat size={13} className="text-primary" /> <span className="max-w-24 truncate">{t.note ?? c?.name}</span> <b className="num">{fmt(t.amount)}</b>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <Label>Catégorie {!catTouched && note && suggestCategory(note, cats) ? '· proposée automatiquement' : ''}</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {cats.map((c) => (
              <button key={c.id} onClick={() => { setCat(c.id); setCatTouched(true); }}
                className={cx('flex flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-center transition', cat === c.id ? 'border-primary bg-primary/10' : 'border-transparent')}>
                <Glyph icon={c.icon} logo={c.logo} label={c.name} size={36} active={cat === c.id} />
                <span className="w-full truncate text-[10.5px] font-semibold leading-tight">{c.name}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {mode === 'income' && (
        <>
          <Label>Type de revenu</Label>
          <div className="grid grid-cols-4 gap-1.5">
            {incomes.map((c) => (
              <button key={c.id} onClick={() => setInc(c.id)} className={cx('flex flex-col items-center gap-1 rounded-2xl border px-1 py-2', inc === c.id ? 'border-primary bg-primary/10' : 'border-transparent')}>
                <Glyph icon={c.icon} logo={c.logo} label={c.name} size={36} active={inc === c.id} />
                <span className="w-full truncate text-[10.5px] font-semibold">{c.name}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[11.5px] text-muted">N’enregistre un revenu que lorsque l’argent est réellement reçu. Pour un revenu attendu, utilise « Et si… ? ».</p>
        </>
      )}

      {mode === 'transfer' ? (
        <>
          <Label>Depuis</Label>
          <WalletPicker wallets={wallets} value={fromWallet} onChange={setFromWallet} bal={computeBal} />
          {blocked && <LockedNotice blocked={blocked} amount={n} onUnlock={(g) => { close0(); onUnlock(g); }} />}
          <div className="my-1 flex justify-center text-muted"><LuArrowDown /></div>
          <WalletPicker wallets={wallets} value={toWallet} onChange={setToWallet} bal={computeBal} />
          {n > 0 && fromWallet !== toWallet && (
            <div className="mt-3 rounded-2xl bg-surface2 p-3 text-[12.5px]">
              <b>Simulation :</b> {wallets.find((w) => w.id === fromWallet)?.name} <Money v={computeBal(fromWallet)} /> → <b><Money v={computeBal(fromWallet) - n - (Number(fee) || 0)} /></b>,{' '}
              {wallets.find((w) => w.id === toWallet)?.name} <Money v={computeBal(toWallet)} /> → <b><Money v={computeBal(toWallet) + n} /></b>.
              <div className="mt-1 text-muted">Ton patrimoine total ne change pas (hors frais). Rien n’est enregistré tant que tu ne valides pas.</div>
            </div>
          )}
          <Label>Frais de transfert (facultatif)</Label>
          <input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} placeholder="0" className={inputCls} />
        </>
      ) : (
        <>
          <Label>{mode === 'income' ? 'Reçu sur' : 'Payé avec'}</Label>
          <WalletPicker wallets={wallets} value={wallet} onChange={setWallet} bal={computeBal} />
          {blocked && <LockedNotice blocked={blocked} amount={n} onUnlock={(g) => { close0(); onUnlock(g); }} />}
        </>
      )}

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>Date</Label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>
        <div>
          <Label>{mode === 'expense' ? 'Frais (facultatif)' : 'Note'}</Label>
          {mode === 'expense' ? (
            <input inputMode="numeric" value={fee} onChange={(e) => setFee(e.target.value.replace(/\D/g, ''))} placeholder="0" className={inputCls} />
          ) : (
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Facultatif" className={inputCls} />
          )}
        </div>
      </div>
      {mode === 'expense' && (
        <>
          <Label>Note / commerçant (facultatif)</Label>
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Woro-woro Cocody, marché Gouro…" className={inputCls} />
        </>
      )}
      {mode !== 'transfer' && (
        <>
          <Label>Justificatif (facultatif)</Label>
          <AttachmentsField value={files} onChange={setFiles} />
        </>
      )}
    </Sheet>
  );
}

function WalletPicker({ wallets, value, onChange, bal }: { wallets: { id: string; name: string; icon: string; logo?: string }[]; value: string; onChange: (id: string) => void; bal: (id: string) => number }) {
  return (
    <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
      {wallets.map((w) => (
        <button key={w.id} onClick={() => onChange(w.id)}
          className={cx('flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left', value === w.id ? 'border-primary bg-primary/10' : 'border-line bg-surface')}>
          <Glyph icon={w.icon} logo={w.logo} label={w.name} size={30} />
          <span>
            <span className="block text-[12.5px] font-semibold leading-tight">{w.name}</span>
            <span className="num block text-[11px] leading-tight text-muted">{fmt(bal(w.id))} XOF</span>
          </span>
        </button>
      ))}
    </div>
  );
}
