// Justificatifs (reçus, factures, PDF) : gardés sur le téléphone (IndexedDB),
// puis copiés dans la sauvegarde en ligne privée si un compte est connecté.
import type { Attachment, State } from '../engine';
import { API, loadSession } from './account';

const DB = 'budget-ivoire-files';
const STORE = 'files';
const UPLOADED = 'budget-ivoire:uploaded';
export const MAX_FILE = 5 * 1024 * 1024;

function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const putLocal = (id: string, b: Blob) => tx('readwrite', (s) => s.put(b, id));
const getLocal = (id: string) => tx<Blob | undefined>('readonly', (s) => s.get(id));
const delLocal = (id: string) => tx('readwrite', (s) => s.delete(id));

const uploaded = (): Set<string> => { try { return new Set(JSON.parse(localStorage.getItem(UPLOADED) || '[]')); } catch { return new Set(); } };
const markUploaded = (ids: Set<string>) => { try { localStorage.setItem(UPLOADED, JSON.stringify([...ids].slice(-5000))); } catch { /* plein */ } };

/** Photo réduite (≤ 1600 px, JPEG) ; PDF gardé tel quel. */
async function shrink(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/') || file.type === 'image/heic') return file;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, 1600 / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise<Blob>((res) => c.toBlob((b) => res(b ?? file), 'image/jpeg', 0.82));
  } catch { return file; } finally { URL.revokeObjectURL(url); }
}

const rid = () => 'att_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/** Ajoute un fichier choisi / photographié. */
export async function addAttachment(file: File): Promise<Attachment> {
  const blob = await shrink(file);
  if (blob.size > MAX_FILE) throw new Error('Fichier trop lourd (5 Mo maximum).');
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const mime = isPdf ? 'application/pdf' : blob.type || 'image/jpeg';
  const id = rid();
  await putLocal(id, blob);
  const raw = file.name || (isPdf ? 'justificatif.pdf' : 'justificatif.jpg');
  const name = (blob !== file ? raw.replace(/\.(heif|png|webp|jpeg)$/i, '.jpg') : raw).slice(0, 80);
  return { id, name, mime, size: blob.size, addedAt: new Date().toISOString() };
}

/** Ajoute directement une image déjà en mémoire (ex. le reçu scanné). */
export async function addAttachmentFromDataUrl(dataUrl: string, name = 'recu.jpg'): Promise<Attachment> {
  const blob = await (await fetch(dataUrl)).blob();
  const id = rid();
  await putLocal(id, blob);
  return { id, name, mime: blob.type || 'image/jpeg', size: blob.size, addedAt: new Date().toISOString() };
}

/** Récupère le fichier : sur le téléphone, sinon dans la sauvegarde en ligne (autre téléphone). */
export async function getAttachment(a: Attachment): Promise<Blob | null> {
  const local = await getLocal(a.id).catch(() => undefined);
  if (local) return local;
  const s = loadSession();
  if (!s?.token || !navigator.onLine) return null;
  try {
    const r = await fetch(`${API}/api/files/${a.id}`, { headers: { authorization: `Bearer ${s.token}` } });
    if (!r.ok) return null;
    const { data, mime } = await r.json();
    const bin = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
    const blob = new Blob([bin], { type: mime || a.mime });
    await putLocal(a.id, blob).catch(() => {});
    const up = uploaded(); up.add(a.id); markUploaded(up);
    return blob;
  } catch { return null; }
}

export async function removeAttachment(a: Attachment) {
  await delLocal(a.id).catch(() => {});
  const s = loadSession();
  if (s?.token && navigator.onLine) fetch(`${API}/api/files/${a.id}`, { method: 'DELETE', headers: { authorization: `Bearer ${s.token}` } }).catch(() => {});
  const up = uploaded(); up.delete(a.id); markUploaded(up);
}

const toB64 = (b: Blob) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1] ?? ''); r.onerror = rej; r.readAsDataURL(b); });

let running = false;
/** Envoie les justificatifs pas encore sauvegardés en ligne. */
export async function uploadPendingFiles(state: State, token: string) {
  if (running || !token) return;
  running = true;
  try {
    const up = uploaded();
    const all = state.txs.flatMap((t) => t.attachments ?? []);
    for (const a of all) {
      if (up.has(a.id)) continue;
      const blob = await getLocal(a.id).catch(() => undefined);
      if (!blob) continue; // fichier présent sur un autre téléphone seulement
      const r = await fetch(`${API}/api/files/${a.id}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ mime: a.mime, data: await toB64(blob) }),
      });
      if (!r.ok) break;
      up.add(a.id);
      markUploaded(up);
    }
  } finally { running = false; }
}

export const fileSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1).replace('.', ',')} Mo` : `${Math.max(1, Math.round(n / 1e3))} Ko`);
