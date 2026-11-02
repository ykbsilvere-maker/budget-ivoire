-- Comptes Budget Ivoire : accessibles UNIQUEMENT par la fonction serveur « api » (clé de service).
create table if not exists public.bi_users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text,
  salt text not null,
  hash text not null,
  fails int not null default 0,
  lock_until timestamptz,
  token_version int not null default 0,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
create table if not exists public.bi_data (
  user_id uuid primary key references public.bi_users(id) on delete cascade,
  version int not null default 0,
  updated_at timestamptz not null default now(),
  state jsonb not null
);
create table if not exists public.bi_config (key text primary key, value text not null);

alter table public.bi_users enable row level security;
alter table public.bi_data enable row level security;
alter table public.bi_config enable row level security;
revoke all on public.bi_users, public.bi_data, public.bi_config from anon, authenticated;

create or replace function public.bi_save(p_user uuid, p_base int, p_state jsonb)
returns table(version int, updated_at timestamptz)
language plpgsql security invoker set search_path = public as $$
begin
  if p_base = 0 then
    return query
      insert into public.bi_data as d (user_id, version, updated_at, state)
      values (p_user, 1, now(), p_state)
      on conflict (user_id) do update set version = d.version + 1, updated_at = now(), state = excluded.state
        where d.version = 0
      returning d.version, d.updated_at;
  else
    return query
      update public.bi_data d set version = d.version + 1, updated_at = now(), state = p_state
      where d.user_id = p_user and d.version = p_base
      returning d.version, d.updated_at;
  end if;
end;
$$;
revoke all on function public.bi_save(uuid, int, jsonb) from public, anon, authenticated;
grant execute on function public.bi_save(uuid, int, jsonb) to service_role;
