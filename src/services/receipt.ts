// Couche d'analyse des reçus, indépendante du fournisseur d'IA.
// Le navigateur n'a JAMAIS de clé secrète : il appelle une fonction serveur
// (netlify/functions/analyze-receipt.mjs) qui détient la clé.

export interface ReceiptItem { label: string; amount: number; category?: string }
export interface ReceiptResult {
  amount?: number;
  date?: string;
  merchant?: string;
  category?: string;
  paymentMethod?: string;
  fees?: number;
  items?: ReceiptItem[];
  confidence?: number;
  readable: boolean;
  message?: string;
}

const ENDPOINT = '/.netlify/functions/analyze-receipt';

/** Réduit la photo (≤ 1280 px, JPEG) pour accélérer l'envoi sur réseau mobile. */
export async function compressImage(file: File, max = 1280): Promise<{ base64: string; mediaType: string; preview: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * scale);
    c.height = Math.round(img.height * scale);
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    const preview = c.toDataURL('image/jpeg', 0.82);
    return { base64: preview.split(',')[1], mediaType: 'image/jpeg', preview };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function analyzeReceipt(base64: string, mediaType: string, categories: { id: string; name: string }[]): Promise<ReceiptResult> {
  if (!navigator.onLine) return { readable: false, message: 'Hors connexion : saisis le montant à partir de la photo.' };
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType, categories }),
    });
    if (res.status === 404 || res.status === 501) return { readable: false, message: 'Analyse automatique non configurée sur ce serveur. Saisie manuelle à partir de la photo.' };
    if (!res.ok) return { readable: false, message: 'Analyse indisponible pour le moment. Saisie manuelle à partir de la photo.' };
    return (await res.json()) as ReceiptResult;
  } catch {
    return { readable: false, message: 'Analyse indisponible (réseau). Saisie manuelle à partir de la photo.' };
  }
}
