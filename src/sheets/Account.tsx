import { useEffect, useState } from 'react';
import { LuCloud, LuCloudAlert, LuCloudOff, LuEye, LuEyeOff, LuLogOut, LuRefreshCw, LuShieldCheck, LuTrash2, LuUserRound } from 'react-icons/lu';
import type { Account, SyncStatus } from '../services/account';
import { Btn, Label, Segmented, Sheet, cx, inputCls } from '../ui';

export const STATUS_LABEL: Record<SyncStatus, string> = {
  local: 'Enregistré sur ce téléphone',
  pending: 'En attente de synchronisation',
  syncing: 'Synchronisation…',
  synced: 'Synchronisé',
  offline: 'Hors connexion : envoi au retour du réseau',
  error: 'Erreur : action nécessaire',
};

export function SyncIcon({ status, size = 18 }: { status: SyncStatus; size?: number }) {
  if (status === 'syncing') return <LuRefreshCw size={size} className="animate-spin text-primary" />;
  if (status === 'synced') return <LuCloud size={size} className="text-primary" />;
  if (status === 'pending') return <LuCloud size={size} className="text-[#E09328]" />;
  if (status === 'offline') return <LuCloudOff size={size} className="text-muted" />;
  if (status === 'error') return <LuCloudAlert size={size} className="text-danger" />;
  return <LuCloudOff size={size} className="text-muted" />;
}

export function AccountSheet({ open, onClose, account, onSignedIn }: { open: boolean; onClose: () => void; account: Account; onSignedIn?: () => void }) {
  const { session, status, error } = account;
  const loggedIn = !!session?.token;
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [confirm, setConfirm] = useState<'' | 'wipe' | 'delete'>('');
  const [delPwd, setDelPwd] = useState('');

  useEffect(() => {
    if (!open) return;
    setMsg(''); setPassword(''); setConfirm(''); setDelPwd('');
    if (session?.email) { setEmail(session.email); setMode('login'); }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async () => {
    setBusy(true); setMsg('');
    try {
      await account.signIn(mode, email, password, name);
      onSignedIn?.();
      onClose();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onClose={onClose} title={loggedIn ? 'Mon compte' : 'Sauvegarder mes données'} icon={<LuUserRound className="text-primary" />}>
      {loggedIn ? (
        <>
          <div className="card flex items-center gap-3 p-3.5">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-primary text-[17px] font-bold text-onprimary">{(session!.name || session!.email)[0].toUpperCase()}</span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[15px] font-bold">{session!.name || 'Mon compte'}</div>
              <div className="truncate text-[12.5px] text-muted">{session!.email}</div>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface2 p-3 text-[13px]">
            <SyncIcon status={status} />
            <div className="flex-1">
              <div className="font-semibold">{STATUS_LABEL[status]}</div>
              {session!.lastSync && <div className="text-[11.5px] text-muted">Dernière sauvegarde : {new Date(session!.lastSync).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div>}
              {error && <div className="text-[12px] text-danger">{error}</div>}
            </div>
          </div>
          <Btn className="mt-3 w-full" onClick={() => account.sync()} disabled={status === 'syncing'}><LuRefreshCw /> Synchroniser maintenant</Btn>
          <p className="mt-3 flex items-start gap-2 text-[12px] text-muted">
            <LuShieldCheck className="mt-0.5 shrink-0 text-primary" />
            Sur un nouveau téléphone, connecte-toi avec le même e-mail et le même mot de passe : tout ton budget revient.
          </p>
          <Label>Se déconnecter</Label>
          <div className="grid gap-2">
            <Btn variant="ghost" onClick={() => { account.signOut(false); onClose(); }}><LuLogOut /> Se déconnecter (garder les données ici)</Btn>
            <Btn variant="soft" onClick={() => (confirm === 'wipe' ? (account.signOut(true), onClose()) : setConfirm('wipe'))}>
              {confirm === 'wipe' ? 'Confirmer : effacer ce téléphone' : 'Se déconnecter et effacer ce téléphone'}
            </Btn>
          </div>
          <p className="mt-1 text-[11.5px] text-muted">Utile sur un téléphone partagé. Tes données restent sauvegardées dans ton compte.</p>
          <Label>Supprimer mon compte</Label>
          {confirm === 'delete' ? (
            <div className="grid gap-2">
              <input type="password" value={delPwd} onChange={(e) => setDelPwd(e.target.value)} placeholder="Ton mot de passe pour confirmer" className={inputCls} />
              <Btn variant="danger" onClick={async () => { try { await account.deleteAccount(delPwd); onClose(); } catch (e) { setMsg((e as Error).message); } }}><LuTrash2 /> Supprimer définitivement</Btn>
            </div>
          ) : (
            <Btn variant="danger" className="w-full" onClick={() => setConfirm('delete')}><LuTrash2 /> Supprimer mon compte et mes données en ligne</Btn>
          )}
          {msg && <p className="mt-2 text-[12.5px] text-danger">{msg}</p>}
        </>
      ) : (
        <>
          <p className="text-[13px] text-muted">
            Crée un compte pour sauvegarder ton budget en ligne. Si tu changes de téléphone ou réinstalles l’application, reconnecte-toi et tu retrouves tout.
          </p>
          <div className="mt-3"><Segmented value={mode} onChange={(m) => { setMode(m); setMsg(''); }} options={[{ value: 'login', label: 'Me connecter' }, { value: 'signup', label: 'Créer un compte' }]} /></div>
          {mode === 'signup' && (
            <>
              <Label>Prénom</Label>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Awa" autoComplete="given-name" className={inputCls} />
            </>
          )}
          <Label>E-mail</Label>
          <input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="awa@exemple.ci" className={inputCls} />
          <Label>Mot de passe</Label>
          <div className="relative">
            <input type={show ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password}
              onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()}
              placeholder={mode === 'signup' ? '8 caractères minimum' : ''} className={cx(inputCls, 'pr-12')} />
            <button onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted" aria-label={show ? 'Masquer' : 'Afficher'}>{show ? <LuEyeOff /> : <LuEye />}</button>
          </div>
          {msg && <p className="mt-2 rounded-xl bg-danger/10 p-2.5 text-[12.5px] text-danger">{msg}</p>}
          <Btn className="mt-4 w-full" onClick={submit} disabled={busy || !email || password.length < (mode === 'signup' ? 8 : 1)}>
            {busy ? 'Un instant…' : mode === 'login' ? 'Me connecter' : 'Créer mon compte'}
          </Btn>
          <p className="mt-3 flex items-start gap-2 text-[11.5px] text-muted">
            <LuShieldCheck className="mt-0.5 shrink-0 text-primary" />
            Ton mot de passe est chiffré et n’est jamais stocké en clair. Ne mets jamais ton code Mobile Money ou bancaire ici.
          </p>
        </>
      )}
    </Sheet>
  );
}
