// Compte utilisateur et synchronisation hors ligne → serveur.
// Les données restent TOUJOURS sur le téléphone ; le serveur est une sauvegarde
// qui permet de se reconnecter sur un autre appareil et de tout retrouver.
import { useCallback, useEffect, useRef, useState } from 'react';
import { APP } from '../config';
import type { Store } from '../store';
import { hasData, mergeStates } from '../sync';
import { initialState } from '../data';

declare const __API_BASE__: string;
const API = (typeof __API_BASE__ !== 'undefined' && __API_BASE__) || APP.apiBase || '';
const KEY = 'budget-ivoire:session';

export interface Session { token: string; email: string; name?: string; version: number; dirty: boolean; lastSync?: string }
export type SyncStatus = 'local' | 'pending' | 'syncing' | 'synced' | 'offline' | 'error';

export function loadSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; }
}
function saveSession(s: Session | null) {
  try { s ? localStorage.setItem(KEY, JSON.stringify(s)) : localStorage.removeItem(KEY); } catch { /* ignore */ }
}

class ApiError extends Error { constructor(public status: number, message: string, public body?: any) { super(message); } }

async function api(path: string, opts: { method?: string; body?: unknown; token?: string } = {}) {
  let res: Response;
  try {
    res = await fetch(API + path, {
      method: opts.method ?? 'GET',
      headers: { 'content-type': 'application/json', ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'Pas de connexion Internet. Tes données restent enregistrées sur le téléphone.');
  }
  const body = await res.json().catch(() => ({}));
  if (res.status === 404 && !body.error) throw new ApiError(404, 'La sauvegarde en ligne n’est pas encore activée sur ce site (voir le guide de déploiement).');
  if (!res.ok) throw new ApiError(res.status, body.error || 'Erreur du serveur.', body);
  return body;
}

export function useAccount(store: Store) {
  const [session, setSessionState] = useState<Session | null>(() => loadSession());
  const [status, setStatus] = useState<SyncStatus>(() => (loadSession() ? 'pending' : 'local'));
  const [error, setError] = useState('');
  const stateRef = useRef(store.state);
  const replaceRef = useRef(store.replaceFromSync);
  replaceRef.current = store.replaceFromSync;
  const sessionRef = useRef(session);
  const fromSync = useRef(false);
  const busy = useRef(false);
  stateRef.current = store.state;

  const setSession = useCallback((s: Session | null) => { sessionRef.current = s; setSessionState(s); saveSession(s); }, []);

  /** Récupère la version du serveur, fusionne, puis envoie les changements locaux. */
  const sync = useCallback(async (opts: { replaceIfEmpty?: boolean } = {}) => {
    const s = sessionRef.current;
    if (!s || busy.current) return;
    if (!navigator.onLine) { setStatus('offline'); return; }
    busy.current = true;
    setStatus('syncing');
    try {
      const remote = await api('/api/data', { token: s.token });
      let local = stateRef.current;
      let version = s.version;
      let dirty = s.dirty;
      if (remote.state && remote.version !== s.version) {
        const merged = opts.replaceIfEmpty && !hasData(local) ? remote.state : mergeStates(local, remote.state);
        fromSync.current = true;
        replaceRef.current(merged);
        local = merged;
        version = remote.version;
        if (merged.txs.length !== remote.state.txs.length || merged.updatedAt !== remote.state.updatedAt) dirty = true;
      }
      if (dirty || !remote.state) {
        try {
          const r = await api('/api/data', { method: 'PUT', token: s.token, body: { baseVersion: version, state: local } });
          version = r.version;
        } catch (e) {
          if (e instanceof ApiError && e.status === 409) {
            // Un autre téléphone a écrit entre-temps : on fusionne et on réessaie une fois.
            const merged = mergeStates(local, e.body.current.state);
            fromSync.current = true;
            replaceRef.current(merged);
            const r = await api('/api/data', { method: 'PUT', token: s.token, body: { baseVersion: e.body.current.version, state: merged } });
            version = r.version;
          } else throw e;
        }
      }
      setSession({ ...s, version, dirty: false, lastSync: new Date().toISOString() });
      setStatus('synced');
      setError('');
    } catch (e) {
      const err = e as ApiError;
      if (err.status === 0) setStatus('offline');
      else if (err.status === 401) { setStatus('error'); setError('Ta session a expiré : reconnecte-toi.'); setSession({ ...s, token: '' }); }
      else { setStatus('error'); setError(err.message); }
    } finally {
      busy.current = false;
    }
  }, [setSession]);

  // Toute modification locale → « en attente », puis envoi après 2 s de calme.
  useEffect(() => {
    if (fromSync.current) { fromSync.current = false; return; }
    const s = sessionRef.current;
    if (!s?.token) return;
    if (!s.dirty) setSession({ ...s, dirty: true });
    setStatus(navigator.onLine ? 'pending' : 'offline');
    const t = setTimeout(() => sync(), 2000);
    return () => clearTimeout(t);
  }, [store.state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Au démarrage, au retour du réseau et au retour sur l'app.
  useEffect(() => {
    if (sessionRef.current?.token) sync();
    const on = () => sync();
    const vis = () => document.visibilityState === 'visible' && sync();
    window.addEventListener('online', on);
    document.addEventListener('visibilitychange', vis);
    return () => { window.removeEventListener('online', on); document.removeEventListener('visibilitychange', vis); };
  }, [sync]);

  const signIn = useCallback(async (mode: 'login' | 'signup', email: string, password: string, name?: string) => {
    const r = await api(`/api/auth/${mode}`, { method: 'POST', body: { email, password, name } });
    setSession({ token: r.token, email: r.user.email, name: r.user.name, version: 0, dirty: hasData(stateRef.current) });
    await sync({ replaceIfEmpty: true });
  }, [setSession, sync]);

  const signOut = useCallback((wipe: boolean) => {
    setSession(null);
    setStatus('local');
    if (wipe) { fromSync.current = true; replaceRef.current(initialState()); }
  }, [setSession]);

  const deleteAccount = useCallback(async (password: string) => {
    const s = sessionRef.current;
    if (!s) return;
    await api('/api/account', { method: 'DELETE', token: s.token, body: { password } });
    setSession(null);
    setStatus('local');
  }, [setSession]);

  return { session, status, error, sync, signIn, signOut, deleteAccount, ApiError };
}
export type Account = ReturnType<typeof useAccount>;
export { ApiError };
