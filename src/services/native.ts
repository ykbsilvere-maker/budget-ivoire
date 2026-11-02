// Petites fonctions qui marchent à la fois dans le navigateur et dans l'APK.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

export const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

/** Enregistre / partage un fichier : téléchargement sur le web, menu « Partager » dans l'APK. */
export async function saveFile(name: string, content: string, mime: string) {
  if (isNative()) {
    const res = await Filesystem.writeFile({ path: name, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 } as any);
    await Share.share({ title: name, files: [(res as any).uri], dialogTitle: 'Enregistrer ou envoyer' } as any);
    return;
  }
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

/** Ouvre un lien externe (Google Agenda…) dans l'application adaptée. */
export function openExternal(url: string) {
  if (isNative()) window.location.href = url; // l'APK confie les liens externes au système
  else window.open(url, '_blank', 'noopener');
}
