-- AdminGes SQL 008
-- Endurece la revocación de sesión para bloquear también lecturas personales residuales.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 007.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 7) then
    raise exception 'Primero debes ejecutar SQL 007';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 8) then
    raise exception 'SQL 008 ya fue aplicado';
  end if;
end
$$;

create or replace function public.can_access_persona(target_persona_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor_role text;
  target_role text;
  target_user uuid;
begin
  if not public.is_current_app_session_active() then
    return false;
  end if;

  select p.role into actor_role
  from public.profiles p
  where p.id = auth.uid() and p.is_active = true;

  if actor_role is null then
    return false;
  end if;

  select pe.role, pe.user_id into target_role, target_user
  from public.personas pe
  where pe.id = target_persona_id and pe.is_active = true;

  if target_user = auth.uid() then
    return true;
  end if;

  if actor_role = 'admin' then
    return true;
  end if;

  if not public.has_permission('people.read') then
    return false;
  end if;

  if target_role in ('admin', 'zonal') then
    return false;
  end if;

  return exists (
    select 1
    from public.persona_stores ps
    where ps.persona_id = target_persona_id
      and ps.is_active = true
      and public.can_access_store(ps.store_id)
  ) or exists (
    select 1
    from public.persona_clusters pc
    join public.stores s on s.cluster_id = pc.cluster_id
    where pc.persona_id = target_persona_id
      and pc.is_active = true
      and public.can_access_store(s.id)
  );
end;
$$;

revoke all on function public.can_access_persona(uuid) from public;
grant execute on function public.can_access_persona(uuid) to authenticated;

-- Conserva solo 90 días de intentos de login cada vez que se registra un evento.
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

  delete from public.login_attempts
  where attempted_at < now() - interval '90 days';
end;
$$;

revoke all on function public.record_login_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.record_login_attempt(text, text, boolean) to service_role;

insert into public.app_sql_versions (version, name)
values (8, 'endurecimiento_sesion');

commit;
