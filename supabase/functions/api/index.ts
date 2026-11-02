// Fonction Supabase (Deno) : branche la logique de handler.ts sur la base Postgres.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler, type Storage, type UserRow } from './handler.ts';

const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false },
});

const BUCKET = 'justificatifs';

const storage: Storage = {
  async getSecret() {
    const { data } = await sb.from('bi_config').select('value').eq('key', 'auth_secret').maybeSingle();
    return data?.value ?? null;
  },
  async setSecret(v) {
    await sb.from('bi_config').upsert({ key: 'auth_secret', value: v }, { onConflict: 'key', ignoreDuplicates: true });
  },
  async userByEmail(email) {
    const { data } = await sb.from('bi_users').select('*').eq('email', email).maybeSingle();
    return (data as UserRow) ?? null;
  },
  async userById(id) {
    const { data } = await sb.from('bi_users').select('*').eq('id', id).maybeSingle();
    return (data as UserRow) ?? null;
  },
  async insertUser(u) {
    const { data, error } = await sb.from('bi_users').insert(u).select('*').single();
    if (error) { if (error.code === '23505') return null; throw error; }
    return data as UserRow;
  },
  async updateUser(id, patch) {
    const { error } = await sb.from('bi_users').update(patch).eq('id', id);
    if (error) throw error;
  },
  async deleteUser(id) {
    // Supprime aussi les justificatifs de l'utilisateur.
    const { data: list } = await sb.storage.from(BUCKET).list(id, { limit: 1000 });
    if (list?.length) await sb.storage.from(BUCKET).remove(list.map((f) => `${id}/${f.name}`));
    const { error } = await sb.from('bi_users').delete().eq('id', id);
    if (error) throw error;
  },
  async getData(userId) {
    const { data } = await sb.from('bi_data').select('version, updated_at, state').eq('user_id', userId).maybeSingle();
    return data ? { version: data.version, updatedAt: data.updated_at, state: data.state } : null;
  },
  async saveData(userId, base, state) {
    const { data, error } = await sb.rpc('bi_save', { p_user: userId, p_base: base, p_state: state });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return row ? { version: row.version, updatedAt: row.updated_at } : null;
  },
  // Justificatifs : seau privé « justificatifs », un dossier par utilisateur.
  async putFile(userId, id, bytes, mime) {
    const { error } = await sb.storage.from(BUCKET).upload(`${userId}/${id}`, bytes, { contentType: mime, upsert: true });
    if (error) throw error;
  },
  async getFile(userId, id) {
    const { data, error } = await sb.storage.from(BUCKET).download(`${userId}/${id}`);
    if (error || !data) return null;
    return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || 'application/octet-stream' };
  },
  async deleteFile(userId, id) {
    await sb.storage.from(BUCKET).remove([`${userId}/${id}`]);
  },
};

Deno.serve(createHandler(storage));
