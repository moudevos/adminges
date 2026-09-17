-- AdminGes SQL 007
-- Seguridad: sesiones registradas/revocables y rate limit de inicio de sesión.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 006.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 6) then
    raise exception 'Primero debes ejecutar SQL 006';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 7) then
    raise exception 'SQL 007 ya fue aplicado';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Auditoría y rate limit de login.
-- La tabla no se expone a anon/authenticated; solo funciones service_role.
-- -----------------------------------------------------------------------------
create table public.login_attempts (
  id bigint generated always as identity primary key,
  email_normalized text not null,
  client_ip text not null,
  success boolean not null,
  attempted_at timestamptz not null default now()
);

create index login_attempts_pair_idx
  on public.login_attempts(email_normalized, client_ip, attempted_at desc);
create index login_attempts_ip_idx
  on public.login_attempts(client_ip, attempted_at desc);
create index login_attempts_cleanup_idx
  on public.login_attempts(attempted_at);

alter table public.login_attempts enable row level security;
revoke all on public.login_attempts from anon, authenticated;

create or replace function public.check_login_rate_limit(
  login_email text,
  client_ip text
)
returns table(
  allowed boolean,
  retry_after_seconds integer,
  failure_count integer,
  blocked_until timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(coalesce(login_email, '')));
  normalized_ip text := coalesce(nullif(btrim(client_ip), ''), 'unknown');
  last_success timestamptz;
  last_pair_failure timestamptz;
  last_ip_failure timestamptz;
  pair_failures integer := 0;
  ip_failures integer := 0;
  effective_block timestamptz;
begin
  select max(la.attempted_at)
  into last_success
  from public.login_attempts la
  where la.success = true
    and la.email_normalized = normalized_email
    and la.client_ip = normalized_ip
    and la.attempted_at >= now() - interval '1 hour';

  select count(*)::integer, max(la.attempted_at)
  into pair_failures, last_pair_failure
  from public.login_attempts la
  where la.success = false
    and la.email_normalized = normalized_email
    and la.client_ip = normalized_ip
    and la.attempted_at >= greatest(
      now() - interval '1 hour',
      coalesce(last_success, now() - interval '1 hour')
    );

  select count(*)::integer, max(la.attempted_at)
  into ip_failures, last_ip_failure
  from public.login_attempts la
  where la.success = false
    and la.client_ip = normalized_ip
    and la.attempted_at >= now() - interval '15 minutes';

  -- Escalamiento por pareja correo+IP.
  if pair_failures >= 10 then
    effective_block := last_pair_failure + interval '60 minutes';
  elsif pair_failures >= 8 then
    effective_block := last_pair_failure + interval '30 minutes';
  elsif pair_failures >= 5 then
    effective_block := last_pair_failure + interval '15 minutes';
  end if;

  -- Protección adicional contra barrido de múltiples correos desde una IP.
  if ip_failures >= 20 then
    if effective_block is null or last_ip_failure + interval '30 minutes' > effective_block then
      effective_block := last_ip_failure + interval '30 minutes';
    end if;
  end if;

  allowed := effective_block is null or effective_block <= now();
  blocked_until := case when allowed then null else effective_block end;
  retry_after_seconds := case
    when allowed then 0
    else greatest(1, ceil(extract(epoch from (effective_block - now())))::integer)
  end;
  failure_count := pair_failures;

  return next;
end;
$$;

create or replace function public.record_login_attempt(
  login_email text,
  client_ip text,
  was_success boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.login_attempts (email_normalized, client_ip, success)
  values (
    lower(btrim(coalesce(login_email, ''))),
    coalesce(nullif(btrim(client_ip), ''), 'unknown'),
    was_success
  );
end;
$$;

revoke all on function public.check_login_rate_limit(text, text) from public, anon, authenticated;
revoke all on function public.record_login_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.check_login_rate_limit(text, text) to service_role;
grant execute on function public.record_login_attempt(text, text, boolean) to service_role;

-- -----------------------------------------------------------------------------
-- 2. Sesiones de aplicación ligadas al session_id del JWT de Supabase.
-- El access token sigue siendo JWT; esta tabla agrega revocación inmediata en AdminGes.
-- -----------------------------------------------------------------------------
create table public.app_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  client_ip text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id) on delete set null,
  revocation_reason text
);

create index app_sessions_user_idx on public.app_sessions(user_id, created_at desc);
create index app_sessions_persona_idx on public.app_sessions(persona_id, created_at desc);
create index app_sessions_active_idx on public.app_sessions(user_id, last_seen_at desc)
where revoked_at is null;

alter table public.app_sessions enable row level security;

insert into public.permissions (key, module, description) values
  ('sessions.read', 'seguridad', 'Ver sesiones activas y recientes'),
  ('sessions.revoke', 'seguridad', 'Revocar sesiones de usuarios')
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

insert into public.role_permissions (role, permission_key)
values
  ('admin', 'sessions.read'),
  ('admin', 'sessions.revoke')
on conflict do nothing;

-- Devuelve true si el JWT actual corresponde a una sesión no revocada.
-- Si es una sesión existente previa al SQL 007 y aún no fue registrada, se permite
-- para que touch_app_session la registre en la siguiente petición.
create or replace function public.is_current_app_session_active()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with jwt_session as (
    select nullif(auth.jwt() ->> 'session_id', '')::uuid as session_id
  )
  select case
    when js.session_id is null then false
    when not exists (
      select 1 from public.app_sessions s where s.id = js.session_id
    ) then true
    else exists (
      select 1
      from public.app_sessions s
      where s.id = js.session_id
        and s.user_id = auth.uid()
        and s.revoked_at is null
    )
  end
  from jwt_session js;
$$;

revoke all on function public.is_current_app_session_active() from public;
grant execute on function public.is_current_app_session_active() to authenticated;

-- Registra la sesión o actualiza last_seen como máximo una vez por minuto.
-- Retorna false si la sesión ya fue revocada.
create or replace function public.touch_app_session(
  client_ip text default null,
  client_user_agent text default null
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
  pid uuid;
  active boolean;
begin
  sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;

  if sid is null or auth.uid() is null then
    return false;
  end if;

  select pe.id into pid
  from public.personas pe
  where pe.user_id = auth.uid()
  limit 1;

  insert into public.app_sessions (
    id, user_id, persona_id, client_ip, user_agent, created_at, last_seen_at
  )
  values (
    sid,
    auth.uid(),
    pid,
    nullif(btrim(client_ip), ''),
    nullif(left(client_user_agent, 500), ''),
    now(),
    now()
  )
  on conflict (id) do update
  set
    persona_id = coalesce(public.app_sessions.persona_id, excluded.persona_id),
    client_ip = coalesce(excluded.client_ip, public.app_sessions.client_ip),
    user_agent = coalesce(excluded.user_agent, public.app_sessions.user_agent),
    last_seen_at = case
      when public.app_sessions.last_seen_at < now() - interval '1 minute'
        then now()
      else public.app_sessions.last_seen_at
    end
  where public.app_sessions.revoked_at is null;

  select s.revoked_at is null into active
  from public.app_sessions s
  where s.id = sid and s.user_id = auth.uid();

  return coalesce(active, false);
end;
$$;

revoke all on function public.touch_app_session(text, text) from public;
grant execute on function public.touch_app_session(text, text) to authenticated;

create or replace function public.revoke_current_app_session(reason text default 'Cierre de sesión')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  sid uuid;
begin
  sid := nullif(auth.jwt() ->> 'session_id', '')::uuid;

  if sid is null then
    return;
  end if;

  update public.app_sessions
  set revoked_at = coalesce(revoked_at, now()),
      revoked_by = coalesce(revoked_by, auth.uid()),
      revocation_reason = coalesce(revocation_reason, nullif(reason, ''), 'Cierre de sesión')
  where id = sid and user_id = auth.uid();
end;
$$;

revoke all on function public.revoke_current_app_session(text) from public;
grant execute on function public.revoke_current_app_session(text) to authenticated;

create or replace function public.revoke_app_session(
  target_session_id uuid,
  reason text default 'Revocada por administración'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.has_permission('sessions.revoke') then
    raise exception 'No autorizado';
  end if;

  update public.app_sessions
  set revoked_at = coalesce(revoked_at, now()),
      revoked_by = auth.uid(),
      revocation_reason = coalesce(nullif(reason, ''), 'Revocada por administración')
  where id = target_session_id;

  return found;
end;
$$;

revoke all on function public.revoke_app_session(uuid, text) from public;
grant execute on function public.revoke_app_session(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Permisos y alcance también verifican que la sesión no esté revocada.
-- -----------------------------------------------------------------------------
create or replace function public.current_permissions()
returns table(permission_key text)
language sql
stable
security definer
set search_path = ''
as $$
  with active_profile as (
    select p.id, p.role
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and public.is_current_app_session_active()
  ),
  role_grants as (
    select rp.permission_key
    from public.role_permissions rp
    join active_profile ap on ap.role = rp.role
    where not exists (
      select 1
      from public.user_permissions up
      where up.user_id = ap.id
        and up.permission_key = rp.permission_key
    )
  ),
  user_grants as (
    select up.permission_key
    from public.user_permissions up
    join active_profile ap on ap.id = up.user_id
    where up.allowed = true
  )
  select distinct grants.permission_key
  from (
    select permission_key from role_grants
    union all
    select permission_key from user_grants
  ) grants
  order by grants.permission_key;
$$;

create or replace function public.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with actor as (
    select p.role, pe.id as persona_id
    from public.profiles p
    left join public.personas pe on pe.user_id = p.id and pe.is_active = true
    where p.id = auth.uid()
      and p.is_active = true
      and public.is_current_app_session_active()
    limit 1
  )
  select exists (
    select 1
    from actor a
    where
      a.role = 'admin'
      or (
        a.role = 'zonal'
        and exists (
          select 1
          from public.persona_zones pz
          join public.stores s on s.zone_id = pz.zone_id
          where pz.persona_id = a.persona_id
            and pz.is_active = true
            and s.id = target_store_id
        )
      )
      or (
        a.role = 'supervisor'
        and (
          exists (
            select 1
            from public.persona_clusters pc
            join public.stores s on s.cluster_id = pc.cluster_id
            where pc.persona_id = a.persona_id
              and pc.is_active = true
              and s.id = target_store_id
          )
          or exists (
            select 1
            from public.persona_stores ps
            where ps.persona_id = a.persona_id
              and ps.store_id = target_store_id
              and ps.is_active = true
          )
        )
      )
      or (
        a.role = 'promotor'
        and exists (
          select 1
          from public.persona_stores ps
          where ps.persona_id = a.persona_id
            and ps.store_id = target_store_id
            and ps.is_active = true
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- 4. RLS de sesiones.
-- Cada usuario ve las propias; Admin con sessions.read ve todas.
-- -----------------------------------------------------------------------------
create policy app_sessions_select_allowed
on public.app_sessions
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_permission('sessions.read')
);

grant select on public.app_sessions to authenticated;
revoke insert, update, delete on public.app_sessions from authenticated;

insert into public.app_sql_versions (version, name)
values (7, 'seguridad_sesiones_rate_limit');

commit;

-- Verificación sugerida:
-- select version, name, applied_at from public.app_sql_versions order by version;
-- select * from public.app_sessions order by last_seen_at desc;
-- select email_normalized, client_ip, success, attempted_at
-- from public.login_attempts order by attempted_at desc limit 100;
