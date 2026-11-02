// Fonction serveur Netlify : analyse d'un reçu par IA.
// La clé reste côté serveur : définissez ANTHROPIC_API_KEY dans
// Netlify > Site configuration > Environment variables.
// Sans clé, la fonction répond 501 et l'application passe en saisie manuelle.

const MODEL = process.env.RECEIPT_MODEL || 'claude-haiku-5-5';

// Origines autorisées : le site lui-même + l'application Android (Capacitor).
const ALLOWED = ['https://localhost', 'capacitor://localhost', 'http://localhost'];
const cors = (req) => {
  const o = req.headers.get('origin');
  return ALLOWED.includes(o) ? { 'Access-Control-Allow-Origin': o, 'Access-Control-Allow-Headers': 'content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' } : {};
};

export default async (req) => {
  const res = await handle(req);
  for (const [k, v] of Object.entries(cors(req))) res.headers.set(k, v);
  return res;
};

async function handle(req) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return Response.json({ readable: false, message: 'Clé IA non configurée.' }, { status: 501 });

  let body;
  try { body = await req.json(); } catch { return new Response('Bad Request', { status: 400 }); }
  const { image, mediaType = 'image/jpeg', categories = [] } = body ?? {};
  if (!image || typeof image !== 'string' || image.length > 6_000_000) return new Response('Image invalide', { status: 400 });

  const catList = categories.map((c) => `${c.id} = ${c.name}`).join('\n');
  const prompt = `Tu analyses une photo de reçu, facture (CIE, SODECI…), ticket ou capture de paiement Mobile Money en Côte d'Ivoire.
Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{"readable": bool, "amount": nombre en FCFA (total payé), "date": "AAAA-MM-JJ" ou null, "merchant": texte ou null,
 "category": un identifiant de la liste ou null, "paymentMethod": "cash"|"wave"|"orange"|"mtn"|"moov"|"card"|"bank"|null,
 "fees": nombre ou null, "items": [{"label": texte, "amount": nombre, "category": identifiant}] (vide si illisible),
 "confidence": nombre entre 0 et 1}
Si la photo est floue ou le total illisible, mets "readable": false. N'invente jamais un montant.
Catégories possibles :
${catList}`;

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 800,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: prompt },
      ] }],
    }),
  });
  if (!r.ok) return Response.json({ readable: false, message: 'Le service d’analyse a refusé la demande.' }, { status: 502 });
  const data = await r.json();
  const text = (data.content ?? []).map((c) => c.text ?? '').join('');
  const match = text.match(/\{[\s\S]*\}/);
  try {
    const parsed = JSON.parse(match ? match[0] : text);
    return Response.json(parsed);
  } catch {
    return Response.json({ readable: false, message: 'Réponse illisible, saisie manuelle.' });
  }
}
