-- AdminGes SQL 006
-- Estructura organizacional: roles, puestos, zonas, clusters y alcance territorial.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 005.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 5) then
    raise exception 'Primero debes ejecutar SQL 005';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 6) then
    raise exception 'SQL 006 ya fue aplicado';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Catálogo de roles del sistema.
-- Rol = permisos. Puesto = función organizacional. No son la misma cosa.
-- -----------------------------------------------------------------------------
create table if not exists public.system_roles (
  code text primary key,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.system_roles (code, name, description) values
  ('admin', 'Administrador', 'Administración global del sistema'),
  ('zonal', 'Zonal', 'Gestión operativa dentro de una o más zonas'),
  ('supervisor', 'Supervisor', 'Gestión operativa por cluster o tiendas directas'),
  ('promotor', 'Promotor', 'Operación asignada a tienda')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.role_permissions drop constraint if exists role_permissions_role_check;
alter table public.personas drop constraint if exists personas_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'zonal', 'supervisor', 'promotor'));

alter table public.role_permissions
  add constraint role_permissions_role_check
  check (role in ('admin', 'zonal', 'supervisor', 'promotor'));

alter table public.personas
  add constraint personas_role_check
  check (role in ('admin', 'zonal', 'supervisor', 'promotor'));

alter table public.profiles drop constraint if exists profiles_role_catalog_fk;
alter table public.role_permissions drop constraint if exists role_permissions_role_catalog_fk;
alter table public.personas drop constraint if exists personas_role_catalog_fk;

alter table public.profiles
  add constraint profiles_role_catalog_fk
  foreign key (role) references public.system_roles(code) on update cascade;

alter table public.role_permissions
  add constraint role_permissions_role_catalog_fk
  foreign key (role) references public.system_roles(code) on update cascade;

alter table public.personas
  add constraint personas_role_catalog_fk
  foreign key (role) references public.system_roles(code) on update cascade;

-- -----------------------------------------------------------------------------
-- 2. Puestos organizacionales.
-- -----------------------------------------------------------------------------
create table public.puestos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.puestos (code, name, description) values
  ('administrador', 'Administrador', 'Administración general'),
  ('zonal', 'Zonal', 'Responsable de una zona de tiendas'),
  ('supervisor', 'Supervisor', 'Responsable de cluster o tiendas directas'),
  ('promotor', 'Promotor', 'Ejecución comercial en tienda')
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    is_active = true;

alter table public.personas
  add column if not exists puesto_id uuid references public.puestos(id) on delete restrict;

update public.personas pe
set puesto_id = pu.id
from public.puestos pu
where pe.puesto_id is null
  and pu.code = case pe.role
    when 'admin' then 'administrador'
    when 'zonal' then 'zonal'
    when 'supervisor' then 'supervisor'
    else 'promotor'
  end;

alter table public.personas
  alter column puesto_id set not null;

create index if not exists personas_puesto_id_idx on public.personas(puesto_id);

create trigger puestos_set_updated_at
before update on public.puestos
for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- 3. Jerarquía territorial: Zona > Cluster > Tienda.
-- Una tienda pertenece a una zona y opcionalmente a un cluster de esa zona.
-- -----------------------------------------------------------------------------
create table public.zones (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clusters (
  id uuid primary key default gen_random_uuid(),
  zone_id uuid not null references public.zones(id) on delete restrict,
  code text not null,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (zone_id, code),
  unique (id, zone_id)
);

create trigger zones_set_updated_at
before update on public.zones
for each row execute function public.set_updated_at();

create trigger clusters_set_updated_at
before update on public.clusters
for each row execute function public.set_updated_at();

alter table public.stores
  add column if not exists zone_id uuid references public.zones(id) on delete restrict,
  add column if not exists cluster_id uuid references public.clusters(id) on delete set null;

create index if not exists stores_zone_id_idx on public.stores(zone_id);
create index if not exists stores_cluster_id_idx on public.stores(cluster_id);
create index if not exists clusters_zone_id_idx on public.clusters(zone_id);

create or replace function public.sync_store_territory()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cluster_zone uuid;
begin
  if new.cluster_id is null then
    return new;
  end if;

  select c.zone_id into cluster_zone
  from public.clusters c
  where c.id = new.cluster_id;

  if cluster_zone is null then
    raise exception 'Cluster inválido';
  end if;

  if new.zone_id is null then
    new.zone_id := cluster_zone;
  elsif new.zone_id <> cluster_zone then
    raise exception 'La tienda y el cluster deben pertenecer a la misma zona';
  end if;

  return new;
end;
$$;

drop trigger if exists stores_sync_territory on public.stores;
create trigger stores_sync_territory
before insert or update of zone_id, cluster_id on public.stores
for each row execute function public.sync_store_territory();

-- -----------------------------------------------------------------------------
-- 4. Asignaciones de alcance por Persona.
-- Zonal -> zonas. Supervisor Cluster -> clusters.
-- Supervisor KIO/SES y Promotor -> tiendas directas.
-- -----------------------------------------------------------------------------
create table public.persona_zones (
  persona_id uuid not null references public.personas(id) on delete cascade,
  zone_id uuid not null references public.zones(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (persona_id, zone_id)
);

create table public.persona_clusters (
  persona_id uuid not null references public.personas(id) on delete cascade,
  cluster_id uuid not null references public.clusters(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (persona_id, cluster_id)
);

create table public.persona_stores (
  persona_id uuid not null references public.personas(id) on delete cascade,
  store_id uuid not null references public.stores(id) on delete cascade,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (persona_id, store_id)
);

create trigger persona_zones_set_updated_at
before update on public.persona_zones
for each row execute function public.set_updated_at();

create trigger persona_clusters_set_updated_at
before update on public.persona_clusters
for each row execute function public.set_updated_at();

create trigger persona_stores_set_updated_at
before update on public.persona_stores
for each row execute function public.set_updated_at();

create index persona_zones_zone_idx on public.persona_zones(zone_id) where is_active = true;
create index persona_clusters_cluster_idx on public.persona_clusters(cluster_id) where is_active = true;
create index persona_stores_store_idx on public.persona_stores(store_id) where is_active = true;

-- Compatibilidad: convierte las asignaciones antiguas de supervisor en tiendas directas.
insert into public.persona_stores (persona_id, store_id, is_active, created_by)
select pe.id, ss.store_id, ss.is_active, pe.created_by
from public.store_supervisors ss
join public.personas pe on pe.user_id = ss.user_id
where ss.is_active = true
on conflict (persona_id, store_id) do update
set is_active = excluded.is_active,
    updated_at = now();

-- Compatibilidad: cualquier store_id previo de Persona pasa a asignación directa.
insert into public.persona_stores (persona_id, store_id, is_active, created_by)
select pe.id, pe.store_id, pe.is_active, pe.created_by
from public.personas pe
where pe.store_id is not null
on conflict (persona_id, store_id) do update
set is_active = excluded.is_active,
    updated_at = now();

-- -----------------------------------------------------------------------------
-- 5. Permisos nuevos de Personal y Territorio.
-- Los permisos antiguos se conservan para no romper SQL anteriores.
-- -----------------------------------------------------------------------------
insert into public.permissions (key, module, description) values
  ('people.read', 'personal', 'Ver personas dentro del alcance permitido'),
  ('people.create', 'personal', 'Crear personas dentro del alcance permitido'),
  ('people.update', 'personal', 'Actualizar personas dentro del alcance permitido'),
  ('territory.read', 'territorio', 'Ver zonas, clusters y asignaciones permitidas'),
  ('territory.manage', 'territorio', 'Administrar zonas, clusters y asignaciones')
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

-- Admin recibe cualquier permiso actual o futuro que exista al ejecutar este SQL.
insert into public.role_permissions (role, permission_key)
select 'admin', p.key
from public.permissions p
on conflict do nothing;

-- Zonal: operación completa dentro de su zona, sin administración global del sistema.
insert into public.role_permissions (role, permission_key) values
  ('zonal', 'people.read'),
  ('zonal', 'people.create'),
  ('zonal', 'people.update'),
  ('zonal', 'stores.read'),
  ('zonal', 'territory.read'),
  ('zonal', 'inventory.read'),
  ('zonal', 'inventory.manage'),
  ('zonal', 'sales.read'),
  ('zonal', 'schedules.read'),
  ('zonal', 'schedules.manage'),
  ('zonal', 'quotas.read'),
  ('zonal', 'quotas.manage'),
  ('zonal', 'analytics.read')
on conflict do nothing;

-- Supervisor puede administrar Personal operativo de su alcance; las Server Actions
-- impiden que eleve roles por encima de Promotor.
insert into public.role_permissions (role, permission_key) values
  ('supervisor', 'people.read'),
  ('supervisor', 'people.create'),
  ('supervisor', 'people.update'),
  ('supervisor', 'territory.read')
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 6. Funciones canónicas de alcance.
-- -----------------------------------------------------------------------------
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

revoke all on function public.can_access_store(uuid) from public;
grant execute on function public.can_access_store(uuid) to authenticated;

create or replace function public.persona_scope_type(target_persona_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when pe.role = 'admin' then 'global'
    when pe.role = 'zonal' and exists (
      select 1 from public.persona_zones pz
      where pz.persona_id = pe.id and pz.is_active = true
    ) then 'zona'
    when pe.role = 'supervisor' and exists (
      select 1 from public.persona_clusters pc
      where pc.persona_id = pe.id and pc.is_active = true
    ) then 'cluster'
    when pe.role = 'supervisor' and exists (
      select 1 from public.persona_stores ps
      where ps.persona_id = pe.id and ps.is_active = true
    ) then 'tiendas'
    when pe.role = 'promotor' and exists (
      select 1 from public.persona_stores ps
      where ps.persona_id = pe.id and ps.is_active = true
    ) then 'tienda'
    else 'sin_asignacion'
  end
  from public.personas pe
  where pe.id = target_persona_id;
$$;

revoke all on function public.persona_scope_type(uuid) from public;
grant execute on function public.persona_scope_type(uuid) to authenticated;

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

-- -----------------------------------------------------------------------------
-- 7. RLS: lectura según alcance; escrituras sensibles solo vía servidor/service role.
-- -----------------------------------------------------------------------------
alter table public.zones enable row level security;
alter table public.clusters enable row level security;
alter table public.puestos enable row level security;
alter table public.persona_zones enable row level security;
alter table public.persona_clusters enable row level security;
alter table public.persona_stores enable row level security;

create policy zones_select_scope
on public.zones for select to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1 from public.stores s
    where s.zone_id = zones.id and public.can_access_store(s.id)
  )
);

create policy clusters_select_scope
on public.clusters for select to authenticated
using (
  public.current_user_role() = 'admin'
  or exists (
    select 1 from public.stores s
    where s.cluster_id = clusters.id and public.can_access_store(s.id)
  )
);

create policy puestos_select_authenticated
on public.puestos for select to authenticated
using (true);

create policy persona_zones_select_scope
on public.persona_zones for select to authenticated
using (public.can_access_persona(persona_id));

create policy persona_clusters_select_scope
on public.persona_clusters for select to authenticated
using (public.can_access_persona(persona_id));

create policy persona_stores_select_scope
on public.persona_stores for select to authenticated
using (public.can_access_persona(persona_id));

-- Reemplaza las políticas de Persona del SQL 005 por la regla canónica de alcance.
drop policy if exists personas_select_allowed on public.personas;
drop policy if exists personas_insert_allowed on public.personas;
drop policy if exists personas_update_allowed on public.personas;

create policy personas_select_scope
on public.personas for select to authenticated
using (public.can_access_persona(id));

revoke insert, update, delete on public.personas from authenticated;
revoke insert, update, delete on public.persona_zones from authenticated;
revoke insert, update, delete on public.persona_clusters from authenticated;
revoke insert, update, delete on public.persona_stores from authenticated;
revoke insert, update, delete on public.zones from authenticated;
revoke insert, update, delete on public.clusters from authenticated;

 grant select on public.personas to authenticated;
 grant select on public.puestos to authenticated;
 grant select on public.zones to authenticated;
 grant select on public.clusters to authenticated;
 grant select on public.persona_zones to authenticated;
 grant select on public.persona_clusters to authenticated;
 grant select on public.persona_stores to authenticated;

insert into public.app_sql_versions (version, name)
values (6, 'estructura_organizacional_alcance');

commit;

-- Verificación sugerida:
-- select version, name, applied_at from public.app_sql_versions order by version;
-- select id, code, name from public.puestos order by name;
-- select id, code, name from public.zones order by name;
-- select id, zone_id, code, name from public.clusters order by name;
-- select pe.id, pe.first_name, pe.last_name, pe.role, pu.name as puesto,
--        public.persona_scope_type(pe.id) as alcance
-- from public.personas pe
-- join public.puestos pu on pu.id = pe.puesto_id
-- order by pe.last_name, pe.first_name;
