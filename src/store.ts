import { useCallback, useEffect, useRef, useState } from 'react';
import type { Category, State, Tx, Wallet, Settings } from './engine';
import { toISODate } from './engine';
import { DEFAULT_CATEGORIES, DEFAULT_GROUPS, DEFAULT_INCOME, DEFAULT_WALLETS, initialState, withDefaultImage } from './data';
import { ICONS } from './icons';

const KEY = 'budget-ivoire:v2';
const UI_KEY = 'budget-ivoire:ui';

export type ThemeId = 'emeraude' | 'nuit' | 'wax' | 'lagune';
export interface UiPrefs { theme: ThemeId; dark: boolean; onboarded: boolean }

function load<T>(key: string, fallback: () => T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback();
  } catch {
    return fallback();
  }
}
function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

export const uid = (p = 't') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

export function useUiPrefs() {
  const [ui, setUi] = useState<UiPrefs>(() =>
    load(UI_KEY, () => ({
      theme: 'emeraude' as ThemeId,
      dark: typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches,
      onboarded: false,
    })),
  );
  useEffect(() => {
    save(UI_KEY, ui);
    const el = document.documentElement;
    el.dataset.theme = ui.theme;
    el.classList.toggle('dark', ui.dark || ui.theme === 'nuit');
    const meta = document.querySelector('meta[name="theme-color"]');
    const colors: Record<ThemeId, string> = { emeraude: '#087B48', nuit: '#070F0B', wax: '#C9471F', lagune: '#0E7C7B' };
    meta?.setAttribute('content', colors[ui.theme]);
  }, [ui]);
  return [ui, setUi] as const;
}

/** Migration : retire les anciennes données de démonstration et convertit les anciennes icônes. */
function migrate(raw: State): State {
  const s: State = { ...raw };
  const hadDemo = s.txs.some((t: any) => t.demo);
  if (hadDemo) {
    s.txs = s.txs.filter((t: any) => !t.demo);
    s.wallets = DEFAULT_WALLETS();
    s.settings = { ...s.settings, expectedIncome: 0 };
  }
  const fix = <T extends { id: string; icon: string }>(list: T[], defaults: { id: string; icon: string }[], fallback: string) =>
    list.map((x) => (x.icon && !ICONS[x.icon] ? { ...x, icon: defaults.find((d) => d.id === x.id)?.icon ?? fallback } : x));
  s.categories = fix(s.categories, DEFAULT_CATEGORIES, 'tag');
  s.incomeCategories = fix(s.incomeCategories, DEFAULT_INCOME, 'in');
  s.wallets = fix(s.wallets, DEFAULT_WALLETS(), '');
  // Ajouts de la version « 5 onglets » : groupes, échéances, objectifs, crédits.
  s.groups = s.groups?.length ? s.groups : DEFAULT_GROUPS.map((g) => ({ ...g }));
  s.goals = s.goals ?? [];
  s.debts = s.debts ?? [];
  s.categories = s.categories.map((c) => {
    const d = DEFAULT_CATEGORIES.find((x) => x.id === c.id);
    return withDefaultImage({ ...c, group: c.group ?? d?.group ?? 'g_other', dueDay: c.dueDay ?? d?.dueDay });
  });
  // 1.4 : images proposées d'office (sauf si l'utilisateur a déjà choisi / retiré une image).
  s.wallets = s.wallets.map(withDefaultImage);
  return s;
}

export function useBudgetStore() {
  const [state, setRawState] = useState<State>(() => migrate(load(KEY, () => initialState())));
  // Toute modification par l'utilisateur est horodatée (utile pour fusionner entre appareils).
  const setState = useCallback((u: State | ((s: State) => State)) =>
    setRawState((s) => ({ ...(typeof u === 'function' ? u(s) : u), updatedAt: new Date().toISOString() })), []);
  /** Remplace les données sans les horodater (réception depuis le serveur). */
  const replaceFromSync = useCallback((next: State) => setRawState(migrate(next)), []);
  const [savedAt, setSavedAt] = useState<string>('');
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    save(KEY, state);
    setSavedAt(new Date().toISOString());
  }, [state]);

  const addTx = useCallback((t: Omit<Tx, 'id' | 'createdAt'>) => {
    const tx: Tx = { ...t, id: uid(), createdAt: new Date().toISOString() };
    setState((s) => ({ ...s, txs: [...s.txs, tx] }));
    return tx.id;
  }, []);

  const updateTx = useCallback((id: string, patch: Partial<Tx>) => {
    setState((s) => ({
      ...s,
      txs: s.txs.map((t) => {
        if (t.id !== id) return t;
        const before: Partial<Tx> = {};
        (Object.keys(patch) as (keyof Tx)[]).forEach((k) => { if (k !== 'history') (before as any)[k] = t[k]; });
        // Traçabilité : chaque modification conserve la version précédente.
        return { ...t, ...patch, history: [...(t.history ?? []), { at: new Date().toISOString(), before }] };
      }),
    }));
  }, []);

  const deleteTx = useCallback((id: string) => setState((s) => ({ ...s, txs: s.txs.filter((t) => t.id !== id), deletedTxIds: [...(s.deletedTxIds ?? []), id].slice(-3000) })), []);
  const setCategories = useCallback((categories: Category[]) => setState((s) => ({ ...s, categories })), []);
  const updateCategory = useCallback(
    (id: string, patch: Partial<Category>) =>
      setState((s) => ({ ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, ...patch } : c)) })),
    [],
  );
  const addCategory = useCallback((c: Category) => setState((s) => ({ ...s, categories: [...s.categories, c] })), []);
  const updateWallet = useCallback(
    (id: string, patch: Partial<Wallet>) =>
      setState((s) => ({
        ...s,
        wallets: s.wallets.map((w) => (w.id === id ? { ...w, ...patch, updatedAt: new Date().toISOString() } : w)),
      })),
    [],
  );
  const addWallet = useCallback((w: Wallet) => setState((s) => ({ ...s, wallets: [...s.wallets, w] })), []);
  const setSettings = useCallback((patch: Partial<Settings>) => setState((s) => ({ ...s, settings: { ...s.settings, ...patch } })), []);
  const resetAll = useCallback(() => setState(initialState()), []);
  const importState = useCallback((next: State) => setState(migrate(next)), []);
  const setAll = useCallback((fn: (s: State) => State) => setState(fn), []);

  return {
    state, savedAt,
    addTx, updateTx, deleteTx, setCategories, updateCategory, addCategory, updateWallet, addWallet, setSettings,
    resetAll, importState, setAll, replaceFromSync,
  };
}
export type Store = ReturnType<typeof useBudgetStore>;

export const todayISO = () => toISODate(new Date());

export { saveFile as download } from './services/native';
