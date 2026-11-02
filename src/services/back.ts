// Bouton « Retour » du téléphone : ferme d'abord la fenêtre ouverte, puis revient à l'écran précédent,
// et ne quitte l'application qu'à la racine (après un second appui).
import { useEffect, useRef } from 'react';
import { App } from '@capacitor/app';
import { isNative } from './native';

type Handler = () => void;
const stack: { id: number; run: () => void }[] = [];
let seq = 0;
let root: () => boolean = () => false;

/** Enregistre une action « retour » tant que `active` est vrai (la plus récente passe en premier). */
export function useBackHandler(active: boolean, handler: Handler) {
  const ref = useRef(handler);
  ref.current = handler;
  useEffect(() => {
    if (!active) return;
    const id = ++seq;
    stack.push({ id, run: () => ref.current() });
    return () => {
      const i = stack.findIndex((h) => h.id === id);
      if (i >= 0) stack.splice(i, 1);
    };
  }, [active]);
}

/** Action à la racine (ex. revenir à l'onglet Budget). Retourne true si elle a fait quelque chose. */
export function setRootBack(fn: () => boolean) { root = fn; }

export function handleBack(): boolean {
  const top = stack[stack.length - 1];
  if (top) { top.run(); return true; }
  return root();
}

let lastPress = 0;
/** Branche le bouton retour d'Android (APK) et le retour du navigateur (web). */
export function initBackButton(onExitHint: () => void) {
  if (isNative()) {
    App.addListener('backButton', () => {
      if (handleBack()) return;
      const now = Date.now();
      if (now - lastPress < 2000) {
        (App.minimizeApp ? App.minimizeApp() : App.exitApp()).catch(() => App.exitApp());
      } else {
        lastPress = now;
        onExitHint();
      }
    }).catch(() => {});
    return;
  }
  // Web : une entrée d'historique « tampon » permet d'intercepter le retour du navigateur.
  try {
    history.pushState({ bi: 1 }, '');
    window.addEventListener('popstate', () => {
      if (handleBack()) history.pushState({ bi: 1 }, '');
    });
  } catch { /* historique indisponible */ }
}
