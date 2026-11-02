// Verrouillage : écran de code à 4 chiffres (+ empreinte), réglages de confidentialité.
import { useCallback, useEffect, useRef, useState } from 'react';
import { LuDelete, LuFingerprint, LuLock, LuX } from 'react-icons/lu';
import { Logo } from '../config';
import { Btn, Label, cx, inputCls } from '../ui';
import {
  askBiometric, biometryAvailable, checkPin, getSecurity, hasPin, removePin, setPin, setSecurity, useSecurity, type LockArea,
} from '../services/security';
import { loadSession, verifyPassword } from '../services/account';
import { useBackHandler } from '../services/back';

/** Clavier à 4 chiffres. */
function CodePad({ onCode, error, busy, onBio }: { onCode: (c: string) => void; error?: string; busy?: boolean; onBio?: () => void }) {
  const [code, setCode] = useState('');
  const [shake, setShake] = useState(false);
  useEffect(() => { if (error) { setShake(true); setCode(''); const t = setTimeout(() => setShake(false), 400); return () => clearTimeout(t); } }, [error]);
  const press = (k: string) => {
    if (busy) return;
    if (k === 'del') return setCode((c) => c.slice(0, -1));
    const next = (code + k).slice(0, 4);
    setCode(next);
    if (next.length === 4) setTimeout(() => { onCode(next); setCode(''); }, 120);
  };
  return (
    <div className="mx-auto w-full max-w-[300px]">
      <div className={cx('mb-2 flex justify-center gap-4', shake && 'anim-shake')}>
        {[0, 1, 2, 3].map((i) => <span key={i} className={cx('h-4 w-4 rounded-full border-2 border-primary transition', i < code.length && 'bg-primary')} />)}
      </div>
      <p className="mb-3 h-5 text-center text-[12.5px] font-semibold text-danger">{error}</p>
      <div className="grid grid-cols-3 gap-2.5">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => <Key key={k} onClick={() => press(k)}>{k}</Key>)}
        {onBio ? <Key onClick={onBio} label="Empreinte digitale"><LuFingerprint size={26} className="text-primary" /></Key> : <span />}
        <Key onClick={() => press('0')}>0</Key>
        <Key onClick={() => press('del')} label="Effacer"><LuDelete size={22} /></Key>
      </div>
    </div>
  );
}
const Key = ({ children, onClick, label }: { children: React.ReactNode; onClick: () => void; label?: string }) => (
  <button onClick={onClick} aria-label={label} className="num grid h-16 place-items-center rounded-full bg-surface2 text-[26px] font-semibold active:bg-primary/15">{children}</button>
);

/** Écran plein de déverrouillage. */
export function LockScreen({ reason, onSuccess, onCancel }: { reason: string; onSuccess: () => void; onCancel?: () => void }) {
  const sec = useSecurity();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [bio, setBio] = useState(false);
  const [forgot, setForgot] = useState(false);
  useBackHandler(!!onCancel, () => onCancel?.());
  const tryBio = useCallback(async () => { if (await askBiometric(reason)) onSuccess(); }, [reason, onSuccess]);
  useEffect(() => {
    let alive = true;
    if (sec.biometric) biometryAvailable().then((ok) => { if (!alive) return; setBio(ok); if (ok) tryBio(); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const onCode = async (c: string) => {
    setBusy(true);
    const r = await checkPin(c);
    setBusy(false);
    if (r.ok) { setError(''); onSuccess(); return; }
    setError(r.wait ? `Trop d’essais. Réessaie dans ${r.wait} s.` : 'Code incorrect');
  };
  return (
    <div className="anim-fade fixed inset-0 z-[80] flex flex-col bg-bg text-ink" role="dialog" aria-modal="true" aria-label="Déverrouiller">
      <div className="safe-top flex justify-end px-3 pt-2">
        {onCancel && <button onClick={onCancel} className="grid h-10 w-10 place-items-center rounded-full bg-surface2" aria-label="Annuler"><LuX /></button>}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
        <Logo size={56} />
        <div className="mt-3 flex items-center gap-1.5 text-[17px] font-bold"><LuLock size={17} /> Saisis ton code</div>
        <p className="mb-6 mt-1 max-w-xs text-center text-[13px] text-muted">{reason}</p>
        {forgot ? <Forgot onDone={onSuccess} onBack={() => setForgot(false)} /> : <CodePad onCode={onCode} error={error} busy={busy} onBio={bio ? tryBio : undefined} />}
        {!forgot && <button onClick={() => setForgot(true)} className="mt-6 text-[12.5px] font-semibold text-muted">Code oublié ?</button>}
      </div>
    </div>
  );
}

function Forgot({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const s = loadSession();
  const [pwd, setPwd] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  if (!s?.email) {
    return (
      <div className="max-w-xs text-center text-[13px] text-muted">
        Sans compte en ligne, le code ne peut pas être réinitialisé depuis l’application (c’est ce qui protège tes données).
        Tu peux effacer les données de l’application dans les réglages Android, puis repartir de zéro.
        <button onClick={onBack} className="mt-3 block w-full font-semibold text-primary">Retour</button>
      </div>
    );
  }
  const go = async () => {
    setBusy(true); setErr('');
    try { await verifyPassword(s.email, pwd); removePin(); onDone(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="w-full max-w-xs">
      <p className="text-center text-[13px] text-muted">Saisis le mot de passe de ton compte <b>{s.email}</b> : le code sera supprimé, tu pourras en choisir un nouveau.</p>
      <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className={cx(inputCls, 'mt-3')} placeholder="Mot de passe du compte" autoFocus />
      {err && <p className="mt-1 text-[12px] text-danger">{err}</p>}
      <Btn className="mt-3 w-full" onClick={go} disabled={!pwd || busy}>{busy ? 'Vérification…' : 'Réinitialiser le code'}</Btn>
      <button onClick={onBack} className="mt-2 w-full text-[12.5px] font-semibold text-muted">Retour</button>
    </div>
  );
}

/**
 * Demande du code à la volée : `await requireCode('raison')` → true si déverrouillé
 * (ou si aucun code n'est défini).
 */
export function useCodePrompt() {
  const [ask, setAsk] = useState<{ reason: string; resolve: (ok: boolean) => void } | null>(null);
  const requireCode = useCallback((reason: string) => {
    if (!hasPin()) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => setAsk({ reason, resolve }));
  }, []);
  const element = ask ? (
    <LockScreen reason={ask.reason} onSuccess={() => { ask.resolve(true); setAsk(null); }} onCancel={() => { ask.resolve(false); setAsk(null); }} />
  ) : null;
  return { element, requireCode };
}

/** Verrouillage de l'application à l'ouverture et au retour (après 1 min en arrière-plan). */
export function useAppLock() {
  const [locked, setLocked] = useState(() => !!getSecurity().lockApp && hasPin());
  const hiddenAt = useRef(0);
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden') hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > 60_000 && getSecurity().lockApp && hasPin()) setLocked(true);
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, []);
  return { locked, unlock: () => setLocked(false), relockAt: hiddenAt };
}

// ---------------------------------------------------------------------
// Réglages « Confidentialité »
// ---------------------------------------------------------------------
const AREAS: { id: LockArea; label: string }[] = [
  { id: 'money', label: 'Patrimoine' }, { id: 'goals', label: 'Objectifs' }, { id: 'calendar', label: 'Activité' },
  { id: 'budget', label: 'Budget' }, { id: 'analysis', label: 'Stats' },
];

export function PrivacySettings({ requireCode, onToast }: { requireCode: (r: string) => Promise<boolean>; onToast: (m: string) => void }) {
  const sec = useSecurity();
  const [setup, setSetup] = useState<null | { step: 1 | 2; first?: string; error?: string }>(null);
  const [bioOk, setBioOk] = useState(false);
  useEffect(() => { biometryAvailable().then(setBioOk); }, []);
  useBackHandler(!!setup, () => setSetup(null));

  const onSetupCode = async (c: string) => {
    if (!setup) return;
    if (setup.step === 1) return setSetup({ step: 2, first: c });
    if (c !== setup.first) return setSetup({ step: 1, error: 'Les deux codes sont différents, recommence.' });
    await setPin(c);
    setSecurity({ lockApp: true, lockProjects: true, areas: getSecurity().areas ?? [], biometric: bioOk });
    setSetup(null);
    onToast('Code enregistré 🔒');
  };
  const toggle = async (patch: Partial<typeof sec>, needCode: boolean) => {
    if (needCode && !(await requireCode('Confirme avec ton code pour modifier la sécurité'))) return;
    setSecurity(patch);
  };

  return (
    <>
      <Label><span className="inline-flex items-center gap-1"><LuLock /> Confidentialité et code</span></Label>
      {!sec.pin ? (
        <div className="rounded-2xl bg-surface2 p-3 text-[12.5px]">
          <p>Protège l’application avec un code à 4 chiffres{bioOk ? ' ou ton empreinte digitale' : ''} : à l’ouverture, pour afficher les montants masqués, pour certains onglets et pour débloquer l’argent d’un projet.</p>
          <Btn className="mt-2 w-full" onClick={() => setSetup({ step: 1 })}>Créer mon code</Btn>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Toggle label="Demander le code à l’ouverture" checked={!!sec.lockApp} onChange={(v) => toggle({ lockApp: v }, !v)} />
          {bioOk && <Toggle label="Utiliser l’empreinte digitale" checked={!!sec.biometric} onChange={(v) => toggle({ biometric: v }, v)} />}
          <Toggle label="Code pour débloquer l’argent d’un projet" checked={!!sec.lockProjects} onChange={(v) => toggle({ lockProjects: v }, !v)} />
          <div className="rounded-2xl bg-surface2 px-3 py-2.5">
            <div className="text-[13.5px]">Onglets protégés par le code</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {AREAS.map((a) => {
                const on = (sec.areas ?? []).includes(a.id);
                return (
                  <button key={a.id} onClick={() => toggle({ areas: on ? (sec.areas ?? []).filter((x) => x !== a.id) : [...(sec.areas ?? []), a.id] }, on)}
                    className={cx('rounded-xl px-3 py-1.5 text-[12.5px] font-semibold', on ? 'bg-primary text-onprimary' : 'bg-surface')}>
                    {on && <LuLock className="mr-1 inline" size={12} />}{a.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1">
            <Btn variant="ghost" onClick={async () => { if (await requireCode('Confirme ton code actuel')) setSetup({ step: 1 }); }}>Changer le code</Btn>
            <Btn variant="soft" onClick={async () => { if (await requireCode('Confirme pour supprimer le code')) { removePin(); setSecurity({ mask: false }); onToast('Code supprimé'); } }}>Supprimer</Btn>
          </div>
        </div>
      )}
      <p className="mt-1.5 text-[11.5px] text-muted">Ce code reste sur ce téléphone, il n’est jamais envoyé. N’utilise pas ton code PIN Mobile Money ou bancaire.</p>

      {setup && (
        <div className="anim-fade fixed inset-0 z-[80] flex flex-col bg-bg text-ink" role="dialog" aria-modal="true">
          <div className="safe-top flex justify-end px-3 pt-2"><button onClick={() => setSetup(null)} className="grid h-10 w-10 place-items-center rounded-full bg-surface2" aria-label="Annuler"><LuX /></button></div>
          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-10">
            <Logo size={56} />
            <div className="mt-3 text-[17px] font-bold">{setup.step === 1 ? 'Choisis un code à 4 chiffres' : 'Confirme ton code'}</div>
            <p className="mb-6 mt-1 max-w-xs text-center text-[13px] text-muted">Évite 1234, 0000 ou ta date de naissance.</p>
            <CodePad key={setup.step} onCode={onSetupCode} error={setup.error} />
          </div>
        </div>
      )}
    </>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center justify-between rounded-2xl bg-surface2 px-3 py-3 text-[13.5px]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-5 w-5 accent-[var(--s-primary)]" />
    </label>
  );
}
