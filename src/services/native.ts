// Petites fonctions qui marchent à la fois dans le navigateur et dans l'APK.
import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { TextZoom } from '@capacitor/text-zoom';

export const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

export const blobToBase64 = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).split(',')[1] ?? '');
    r.onerror = rej;
    r.readAsDataURL(b);
  });

/** Enregistre / partage un fichier (texte ou binaire) : téléchargement sur le web, menu « Partager » dans l'APK. */
export async function saveFile(name: string, content: string | Blob, mime: string) {
  const safe = name.replace(/[^\w.\-]+/g, '_');
  if (isNative()) {
    const res = typeof content === 'string'
      ? await Filesystem.writeFile({ path: safe, data: content, directory: Directory.Cache, encoding: Encoding.UTF8 } as any)
      : await Filesystem.writeFile({ path: safe, data: await blobToBase64(content), directory: Directory.Cache } as any);
    await Share.share({ title: name, files: [(res as any).uri], dialogTitle: 'Enregistrer ou envoyer' } as any);
    return;
  }
  const url = URL.createObjectURL(typeof content === 'string' ? new Blob([content], { type: mime }) : content);
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

/** Limite l'agrandissement des textes imposé par Android (au-delà, les cases débordent). */
export async function limitTextZoom(max = 1.15) {
  if (!isNative()) return;
  try {
    const { value } = await TextZoom.getPreferred();
    await TextZoom.set({ value: Math.min(Math.max(value, 0.85), max) });
  } catch { /* module absent : on garde le réglage du téléphone */ }
}

/** Télécharge une image (chemin intégré « img/… » ou image importée « data:… »). */
export async function saveImage(src: string, baseName: string) {
  const blob = await (await fetch(src)).blob();
  const ext = blob.type.includes('png') ? 'png' : blob.type.includes('webp') ? 'webp' : 'jpg';
  await saveFile(`${baseName.replace(/\s+/g, '-').toLowerCase() || 'image'}.${ext}`, blob, blob.type || 'image/jpeg');
}
