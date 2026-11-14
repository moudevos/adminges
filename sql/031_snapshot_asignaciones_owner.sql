-- Ejecutar manualmente en Supabase SQL Editor despues de SQL 030.
-- Fuente unica de lectura para las asignaciones administrativas activas.
begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 30) then
    raise exception 'SQL_030_REQUIRED';
  end if;
  if exists (select 1 from public.app_sql_versions where version = 31) then
    raise exception 'SQL_031_ALREADY_APPLIED';
  end if;
end $$;

-- Los historicos previos a persona_id se conservan y se enlazan cuando existe perfil.
update public.tienda_supervisores ts
set persona_id = up.persona_id
from public.user_profiles up
where ts.persona_id is null
  and ts.user_id = up.user_id;

update public.zona_zonales zz
set persona_id = up.persona_id
from public.user_profiles up
where zz.persona_id is null
  and zz.user_id = up.user_id;

create index if not exists zona_zonales_active_zone_idx
  on public.zona_zonales(zona_id, persona_id)
  where valid_to is null;
create index if not exists tienda_supervisores_active_store_idx
  on public.tienda_supervisores(tienda_id, persona_id)
  where valid_to is null;
create index if not exists tienda_promotores_active_store_person_idx
  on public.tienda_promotores(tienda_id, persona_id)
  where valid_to is null;

-- SECURITY DEFINER se limita a Owner y no recibe identificadores del cliente.
-- Asi el servidor obtiene una fotografia coherente sin abrir estas tablas por RLS.
create or replace function public.owner_active_assignments_snapshot()
returns table(kind text, entity_id uuid, persona_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
begin
  if not public.is_owner() then
    raise exception 'OWNER_REQUIRED' using errcode = '42501';
  end if;

  return query
    select 'zone_manager'::text, zz.zona_id, zz.persona_id
    from public.zona_zonales zz
    where zz.valid_to is null and zz.persona_id is not null
    union all
    select 'store_supervisor'::text, ts.tienda_id, ts.persona_id
    from public.tienda_supervisores ts
    where ts.valid_to is null and ts.persona_id is not null
    union all
    select 'store_promoter'::text, tp.tienda_id, tp.persona_id
    from public.tienda_promotores tp
    where tp.valid_to is null and tp.persona_id is not null;
end;
$fn$;

revoke all on function public.owner_active_assignments_snapshot() from public, anon, authenticated;
grant execute on function public.owner_active_assignments_snapshot() to authenticated;

insert into public.app_sql_versions(version, name)
values (31, 'snapshot_asignaciones_owner');
notify pgrst, 'reload schema';
commit;
