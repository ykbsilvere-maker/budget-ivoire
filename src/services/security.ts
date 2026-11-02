// Confidentialité : masquer les montants, code à 4 chiffres et empreinte digitale.
// Le code n'est jamais stocké en clair (PBKDF2 + sel) et reste sur ce téléphone : ce n'est PAS
// le code PIN Mobile Money, et il n'est jamais envoyé au serveur.
import { useEffect, useState } from 'react';
import { BiometricAuth } from '@aparajita/capacitor-biometric-auth';
import { isNative } from './native';

export type LockArea = 'money' | 'goals' | 'calendar' | 'analysis' | 'budget';
export interface Security {
  pin?: { salt: string; hash: string };
  biometric?: boolean;
  /** Demander le code à l'ouverture de l'application. */
  lockApp?: boolean;
  /** Onglets protégés. */
  areas?: LockArea[];
  /** Débloquer l'argent d'un projet demande le code. */
  lockProjects?: boolean;
  /** Montants masqués (••••). */
  mask?: boolean;
  fails?: number;
  lockUntil?: number;
}

const KEY = 'budget-ivoire:security';
const read = (): Security => { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; } };
let current: Security = read();
const subs = new Set<(s: Security) => void>();
export const getSecurity = () => current;
export function setSecurity(patch: Partial<Security>) {
  current = { ...current, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* stockage plein */ }
  subs.forEach((f) => f(current));
}
export function useSecurity() {
  const [s, set] = useState(current);
  useEffect(() => { subs.add(set); return () => { subs.delete(set); }; }, []);
  return s;
}

// --- Masquage des montants (utilisé par fmt / fmtK) ---
export const isMasked = () => !!current.mask;

// --- Code à 4 chiffres ---
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');
async function derive(pin: string, salt: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 120_000 }, key, 256);
  return hex(bits);
}
export async function setPin(pin: string) {
  if (!/^\d{4}$/.test(pin)) throw new Error('Le code doit contenir 4 chiffres.');
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)).buffer);
  setSecurity({ pin: { salt, hash: await derive(pin, salt) }, fails: 0, lockUntil: 0 });
}
export function removePin() {
  setSecurity({ pin: undefined, biometric: false, lockApp: false, areas: [], lockProjects: false, fails: 0, lockUntil: 0 });
}
export const hasPin = () => !!current.pin;

/** Vérifie le code. 5 erreurs → attente de 30 s, puis de plus en plus longue. */
export async function checkPin(pin: string): Promise<{ ok: boolean; wait?: number }> {
  const now = Date.now();
  if (current.lockUntil && current.lockUntil > now) return { ok: false, wait: Math.ceil((current.lockUntil - now) / 1000) };
  if (!current.pin) return { ok: true };
  const ok = (await derive(pin, current.pin.salt)) === current.pin.hash;
  if (ok) { setSecurity({ fails: 0, lockUntil: 0 }); return { ok }; }
  const fails = (current.fails ?? 0) + 1;
  const wait = fails >= 5 ? 30 * 2 ** Math.min(5, fails - 5) : 0;
  setSecurity({ fails, lockUntil: wait ? now + wait * 1000 : 0 });
  return { ok: false, wait: wait || undefined };
}

// --- Empreinte digitale (APK uniquement) ---
export async function biometryAvailable(): Promise<boolean> {
  if (!isNative()) return false;
  try { const r = await BiometricAuth.checkBiometry(); return !!(r.isAvailable || r.strongBiometryIsAvailable); } catch { return false; }
}
export async function askBiometric(reason = 'Déverrouiller Budget Ivoire'): Promise<boolean> {
  if (!isNative() || !current.biometric) return false;
  try {
    await BiometricAuth.authenticate({
      reason, cancelTitle: 'Utiliser le code', allowDeviceCredential: false,
      androidTitle: 'Budget Ivoire', androidSubtitle: reason, androidConfirmationRequired: false,
    } as any);
    setSecurity({ fails: 0, lockUntil: 0 });
    return true;
  } catch { return false; }
}
