-- AdminGes SQL 010
-- Ajusta la visibilidad territorial para zonas/clusters vacíos o recién creados.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 009.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 9) then
    raise exception 'Primero debes ejecutar SQL 009';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 10) then
    raise exception 'SQL 010 ya fue aplicado';
  end if;
end
$$;

drop policy if exists zones_select_scope on public.zones;
create policy zones_select_scope
on public.zones
for select
to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.personas actor
    join public.persona_zones pz on pz.persona_id = actor.id
    where actor.user_id = auth.uid()
      and actor.is_active = true
      and pz.zone_id = zones.id
      and pz.is_active = true
  )
  or exists (
    select 1
    from public.stores s
    where s.zone_id = zones.id
      and public.can_access_store(s.id)
  )
);

drop policy if exists clusters_select_scope on public.clusters;
create policy clusters_select_scope
on public.clusters
for select
to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1
    from public.personas actor
    join public.persona_zones pz on pz.persona_id = actor.id
    where actor.user_id = auth.uid()
      and actor.is_active = true
      and pz.zone_id = clusters.zone_id
      and pz.is_active = true
  )
  or exists (
    select 1
    from public.personas actor
    join public.persona_clusters pc on pc.persona_id = actor.id
    where actor.user_id = auth.uid()
      and actor.is_active = true
      and pc.cluster_id = clusters.id
      and pc.is_active = true
  )
  or exists (
    select 1
    from public.stores s
    where s.cluster_id = clusters.id
      and public.can_access_store(s.id)
  )
);

insert into public.app_sql_versions (version, name)
values (10, 'visibilidad_territorial');

commit;
