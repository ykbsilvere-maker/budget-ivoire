// =====================================================================
// API comptes + sauvegarde en ligne de Budget Ivoire (logique pure, testée).
//   POST   /api/auth/signup  { email, password, name } → { token, user }
//   POST   /api/auth/login   { email, password }       → { token, user }
//   GET    /api/data         (Bearer)                  → { version, updatedAt, state }
//   PUT    /api/data         (Bearer) { baseVersion, state } → { version, updatedAt } | 409 { current }  (POST accepté aussi)
//   DELETE /api/account      (Bearer) { password }     → supprime compte + données
// =====================================================================
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';

export interface UserRow {
  id: string; email: string; name?: string | null; salt: string; hash: string;
  fails: number; lock_until?: string | null; token_version: number;
}
export interface DataDoc { version: number; updatedAt: string | null; state: unknown }
export interface Storage {
  getSecret(): Promise<string | null>;
  setSecret(v: string): Promise<void>;
  userByEmail(email: string): Promise<UserRow | null>;
  userById(id: string): Promise<UserRow | null>;
  insertUser(u: Omit<UserRow, 'id' | 'fails' | 'token_version'>): Promise<UserRow | null>; // null si l'e-mail existe
  updateUser(id: string, patch: Partial<UserRow> & { last_login_at?: string }): Promise<void>;
  deleteUser(id: string): Promise<void>;
  getData(userId: string): Promise<DataDoc | null>;
  saveData(userId: string, base: number, state: unknown): Promise<{ version: number; updatedAt: string } | null>; // null = conflit
}

const MAX_BYTES = 4_000_000;
const TOKEN_DAYS = 90;
const MAX_FAILS = 5;
const LOCK_MINUTES = 15;

const b64url = (b: Buffer | string) => Buffer.from(b).toString('base64url');
function hashPassword(password: string, salt = crypto.randomBytes(16)) {
  const hash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return { salt: salt.toString('hex'), hash: hash.toString('hex') };
}
function checkPassword(password: string, u: UserRow) {
  const { hash } = hashPassword(password, Buffer.from(u.salt, 'hex'));
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'));
}

export function createHandler(db: Storage, opts: { secret?: string } = {}) {
  let cachedSecret = opts.secret ?? '';
  async function secret() {
    if (cachedSecret) return cachedSecret;
    let v = await db.getSecret();
    if (!v) { v = crypto.randomBytes(48).toString('hex'); await db.setSecret(v); v = (await db.getSecret()) ?? v; }
    return (cachedSecret = v);
  }
  async function sign(p: Record<string, unknown>) {
    const body = b64url(JSON.stringify(p));
    return `${body}.${b64url(crypto.createHmac('sha256', await secret()).update(body).digest())}`;
  }
  async function verify(token: string) {
    const [body, sig] = (token || '').split('.');
    if (!body || !sig) return null;
    const exp = b64url(crypto.createHmac('sha256', await secret()).update(body).digest());
    if (sig.length !== exp.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(exp))) return null;
    try {
      const p = JSON.parse(Buffer.from(body, 'base64url').toString());
      return p.exp > Date.now() ? p : null;
    } catch { return null; }
  }
  const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'content-type': 'application/json' } });
  const err = (m: string, s: number) => json({ error: m }, s);
  const token = async (u: UserRow) => sign({ uid: u.id, tv: u.token_version, exp: Date.now() + TOKEN_DAYS * 864e5 });

  async function handle(req: Request): Promise<Response> {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    // Le chemin peut être préfixé (/functions/v1/api/...) : on garde ce qui suit « /api ».
    const full = new URL(req.url).pathname.replace(/\/+$/, '');
    const i = full.indexOf('/api/');
    const path = i >= 0 ? full.slice(i) : full;

    let body: any = {};
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      const text = await req.text();
      if (text.length > MAX_BYTES) return err('Données trop volumineuses.', 413);
      try { body = text ? JSON.parse(text) : {}; } catch { return err('Requête invalide.', 400); }
    }

    if (path === '/api/auth/signup' && req.method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');
      const name = String(body.name || '').trim().slice(0, 60) || null;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err('Adresse e-mail invalide.', 400);
      if (password.length < 8) return err('Le mot de passe doit contenir au moins 8 caractères.', 400);
      const u = await db.insertUser({ email, name, ...hashPassword(password) });
      if (!u) return err('Un compte existe déjà avec cet e-mail. Connecte-toi.', 409);
      return json({ token: await token(u), user: { email, name } }, 201);
    }

    if (path === '/api/auth/login' && req.method === 'POST') {
      const email = String(body.email || '').trim().toLowerCase();
      const u = await db.userByEmail(email);
      const generic = 'E-mail ou mot de passe incorrect.';
      if (!u) return err(generic, 401);
      const lock = u.lock_until ? Date.parse(u.lock_until) : 0;
      if (lock > Date.now()) return err(`Trop d’essais. Réessaie dans ${Math.ceil((lock - Date.now()) / 60000)} min.`, 429);
      if (!checkPassword(String(body.password || ''), u)) {
        const fails = (u.fails || 0) + 1;
        await db.updateUser(u.id, { fails, lock_until: fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MINUTES * 60000).toISOString() : null });
        return err(generic, 401);
      }
      await db.updateUser(u.id, { fails: 0, lock_until: null, last_login_at: new Date().toISOString() });
      return json({ token: await token(u), user: { email: u.email, name: u.name } });
    }

    const p = await verify((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''));
    const user = p ? await db.userById(p.uid) : null;
    if (!user || user.token_version !== (p.tv ?? 0)) return err('Session expirée, reconnecte-toi.', 401);

    if (path === '/api/data' && req.method === 'GET') {
      return json((await db.getData(user.id)) ?? { version: 0, updatedAt: null, state: null });
    }
    if (path === '/api/data' && (req.method === 'PUT' || req.method === 'POST')) {
      if (!body.state || typeof body.state !== 'object' || !Array.isArray(body.state.txs)) return err('Données invalides.', 400);
      const saved = await db.saveData(user.id, Number(body.baseVersion ?? 0), body.state);
      if (!saved) return json({ error: 'conflict', current: (await db.getData(user.id)) ?? { version: 0, state: null } }, 409);
      return json(saved);
    }
    if (path === '/api/account' && req.method === 'DELETE') {
      if (!checkPassword(String(body.password || ''), user)) return err('Mot de passe incorrect.', 401);
      await db.deleteUser(user.id);
      return json({ deleted: true });
    }
    return err('Introuvable.', 404);
  }

  return async (req: Request) => {
    let res: Response;
    try { res = await handle(req); } catch (e) { console.error(e); res = err('Erreur du serveur, réessaie plus tard.', 500); }
    // Jetons « Bearer » (pas de cookies) : on peut autoriser toutes les origines (web, APK).
    res.headers.set('Access-Control-Allow-Origin', '*');
    res.headers.set('Access-Control-Allow-Headers', 'content-type, authorization, apikey, x-client-info');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.headers.set('Cache-Control', 'no-store');
    return res;
  };
}

/** Stockage en mémoire (tests). */
export function memoryStorage(): Storage {
  let secret: string | null = null;
  const users = new Map<string, UserRow>();
  const data = new Map<string, DataDoc>();
  return {
    getSecret: async () => secret,
    setSecret: async (v) => { secret ??= v; },
    userByEmail: async (e) => [...users.values()].find((u) => u.email === e) ?? null,
    userById: async (id) => users.get(id) ?? null,
    insertUser: async (u) => {
      if ([...users.values()].some((x) => x.email === u.email)) return null;
      const row = { ...u, id: crypto.randomUUID(), fails: 0, token_version: 0 } as UserRow;
      users.set(row.id, row);
      return row;
    },
    updateUser: async (id, patch) => { const u = users.get(id); if (u) users.set(id, { ...u, ...patch }); },
    deleteUser: async (id) => { users.delete(id); data.delete(id); },
    getData: async (id) => data.get(id) ?? null,
    saveData: async (id, base, state) => {
      const cur = data.get(id)?.version ?? 0;
      if (cur !== base) return null;
      const doc = { version: cur + 1, updatedAt: new Date().toISOString(), state };
      data.set(id, doc);
      return { version: doc.version, updatedAt: doc.updatedAt };
    },
  };
}
