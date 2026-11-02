// Tests de l'API comptes (stockage en mémoire). Lancer : npx tsx tests/api.test.ts
import assert from 'node:assert/strict';
import { createHandler, memoryStorage } from '../supabase/functions/api/handler';

const h = createHandler(memoryStorage());
const call = async (method: string, path: string, body?: unknown, token?: string) => {
  const r = await h(new Request('https://x.supabase.co/functions/v1' + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined }));
  return { status: r.status, body: await r.json().catch(() => null), cors: r.headers.get('access-control-allow-origin') };
};
let r = await call('POST', '/api/auth/signup', { email: 'Awa@Mail.ci', password: 'court' }); assert.equal(r.status, 400);
r = await call('POST', '/api/auth/signup', { email: 'Awa@Mail.ci', password: 'motdepasse1', name: 'Awa' }); assert.equal(r.status, 201); assert.equal(r.cors, '*');
const t1 = r.body.token;
r = await call('POST', '/api/auth/signup', { email: 'awa@mail.ci', password: 'motdepasse1' }); assert.equal(r.status, 409);
r = await call('GET', '/api/data', null, t1); assert.equal(r.body.version, 0);
r = await call('PUT', '/api/data', { baseVersion: 0, state: { txs: [{ id: 'a' }] } }, t1); assert.equal(r.body.version, 1);
r = await call('PUT', '/api/data', { baseVersion: 0, state: { txs: [] } }, t1); assert.equal(r.status, 409); assert.equal(r.body.current.version, 1);
r = await call('POST', '/api/auth/login', { email: ' AWA@mail.ci', password: 'motdepasse1' }); assert.equal(r.status, 200);
const t2 = r.body.token;
r = await call('GET', '/api/data', null, t2); assert.equal((r.body.state as any).txs[0].id, 'a');
r = await call('GET', '/api/data', null, 'faux.jeton'); assert.equal(r.status, 401);
r = await call('GET', '/api/data', null, t2.slice(0, -2) + 'xx'); assert.equal(r.status, 401);
for (let i = 0; i < 5; i++) await call('POST', '/api/auth/login', { email: 'awa@mail.ci', password: 'mauvais' });
r = await call('POST', '/api/auth/login', { email: 'awa@mail.ci', password: 'motdepasse1' }); assert.equal(r.status, 429);
r = await call('POST', '/api/auth/signup', { email: 'koffi@mail.ci', password: 'motdepasse2' });
r = await call('GET', '/api/data', null, r.body.token); assert.equal(r.body.state, null);
// Justificatifs : privés, par utilisateur
const pdf = Buffer.from('%PDF-1.4 test').toString('base64');
r = await call('PUT', '/api/files/att_123456', { mime: 'application/pdf', data: pdf }, t2); assert.equal(r.status, 201);
r = await call('PUT', '/api/files/att_123457', { mime: 'text/html', data: pdf }, t2); assert.equal(r.status, 400);
r = await call('GET', '/api/files/att_123456', null, t2); assert.equal(r.body.data, pdf); assert.equal(r.body.mime, 'application/pdf');
const tk = (await call('POST', '/api/auth/login', { email: 'koffi@mail.ci', password: 'motdepasse2' })).body.token;
r = await call('GET', '/api/files/att_123456', null, tk); assert.equal(r.status, 404); // un autre compte ne voit rien
r = await call('GET', '/api/files/../x', null, t2); assert.equal(r.status, 404);
r = await call('DELETE', '/api/files/att_123456', null, t2); assert.equal(r.status, 200);
r = await call('GET', '/api/files/att_123456', null, t2); assert.equal(r.status, 404);
r = await call('PUT', '/api/files/att_123458', { mime: 'image/jpeg', data: pdf }, t2); assert.equal(r.status, 201);
r = await call('DELETE', '/api/account', { password: 'motdepasse1' }, t2); assert.equal(r.status, 200);
r = await call('GET', '/api/data', null, t2); assert.equal(r.status, 401);
console.log('API OK — 24 vérifications');
