-- AdminGes SQL 009
-- Exige que la sesión exista en Supabase Auth y esté activa en AdminGes.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 008.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 8) then
    raise exception 'Primero debes ejecutar SQL 008';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 9) then
    raise exception 'SQL 009 ya fue aplicado';
  end if;
end
$$;

-- Una sesión válida debe cumplir dos condiciones:
-- 1. Seguir existiendo en auth.sessions (Supabase Auth).
-- 2. No estar revocada en app_sessions (control inmediato de AdminGes).
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
  select coalesce(
    exists (
      select 1
      from jwt_session js
      join auth.sessions aus
        on aus.id = js.session_id
       and aus.user_id = auth.uid()
      where js.session_id is not null
        and (
          not exists (
            select 1
            from public.app_sessions aps
            where aps.id = js.session_id
          )
          or exists (
            select 1
            from public.app_sessions aps
            where aps.id = js.session_id
              and aps.user_id = auth.uid()
              and aps.revoked_at is null
          )
        )
    ),
    false
  );
$$;

revoke all on function public.is_current_app_session_active() from public;
grant execute on function public.is_current_app_session_active() to authenticated;

-- Las políticas RESTRICTIVE se combinan con las políticas funcionales existentes.
-- Aunque una política antigua permita "mi propio registro", una sesión revocada no pasa.
drop policy if exists profiles_require_active_session on public.profiles;
create policy profiles_require_active_session
on public.profiles
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists personas_require_active_session on public.personas;
create policy personas_require_active_session
on public.personas
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists stores_require_active_session on public.stores;
create policy stores_require_active_session
on public.stores
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists puestos_require_active_session on public.puestos;
create policy puestos_require_active_session
on public.puestos
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists zones_require_active_session on public.zones;
create policy zones_require_active_session
on public.zones
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists clusters_require_active_session on public.clusters;
create policy clusters_require_active_session
on public.clusters
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists persona_zones_require_active_session on public.persona_zones;
create policy persona_zones_require_active_session
on public.persona_zones
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists persona_clusters_require_active_session on public.persona_clusters;
create policy persona_clusters_require_active_session
on public.persona_clusters
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists persona_stores_require_active_session on public.persona_stores;
create policy persona_stores_require_active_session
on public.persona_stores
as restrictive
for all
to authenticated
using (public.is_current_app_session_active())
with check (public.is_current_app_session_active());

drop policy if exists app_sessions_require_active_session on public.app_sessions;
create policy app_sessions_require_active_session
on public.app_sessions
as restrictive
for select
to authenticated
using (public.is_current_app_session_active());

insert into public.app_sql_versions (version, name)
values (9, 'sesion_auth_rls_restrictivo');

commit;

-- Verificación:
-- select public.is_current_app_session_active();
-- select id, user_id, last_seen_at, revoked_at from public.app_sessions order by last_seen_at desc;
