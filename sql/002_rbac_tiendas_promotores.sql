-- AdminGes SQL 002
-- RBAC, permisos, tiendas, asignaciones y promotores.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 001.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 1) then
    raise exception 'Primero debes ejecutar SQL 001';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 2) then
    raise exception 'SQL 002 ya fue aplicado';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Perfiles: correo visible para administración interna.
-- -----------------------------------------------------------------------------
alter table public.profiles
  add column if not exists email text;

update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id
  and p.email is distinct from u.email;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.email,
    'supervisor'::public.app_role
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles
  set email = new.email,
      updated_at = now()
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated on auth.users;
create trigger on_auth_user_email_updated
after update of email on auth.users
for each row execute function public.sync_profile_email();

-- -----------------------------------------------------------------------------
-- RBAC: catálogo de permisos, permisos por rol y overrides por usuario.
-- -----------------------------------------------------------------------------
create table public.permissions (
  key text primary key,
  module text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.role_permissions (
  role public.app_role not null,
  permission_key text not null references public.permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role, permission_key)
);

create table public.user_permissions (
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission_key text not null references public.permissions(key) on delete cascade,
  allowed boolean not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

insert into public.permissions (key, module, description) values
  ('users.read', 'usuarios', 'Ver usuarios y roles'),
  ('users.create', 'usuarios', 'Crear usuarios'),
  ('users.update', 'usuarios', 'Actualizar usuarios, roles y estado'),
  ('stores.read', 'tiendas', 'Ver tiendas permitidas'),
  ('stores.create', 'tiendas', 'Crear tiendas'),
  ('stores.update', 'tiendas', 'Actualizar tiendas'),
  ('stores.assign', 'tiendas', 'Asignar supervisores a tiendas'),
  ('promoters.read', 'promotores', 'Ver promotores de tiendas permitidas'),
  ('promoters.create', 'promotores', 'Crear promotores'),
  ('promoters.update', 'promotores', 'Actualizar promotores'),
  ('inventory.read', 'inventario', 'Ver inventario'),
  ('inventory.manage', 'inventario', 'Registrar y ajustar movimientos de inventario'),
  ('sales.read', 'ventas', 'Ver ventas'),
  ('sales.create', 'ventas', 'Registrar ventas'),
  ('schedules.read', 'horarios', 'Ver horarios'),
  ('schedules.manage', 'horarios', 'Administrar horarios'),
  ('quotas.read', 'cuotas', 'Ver cuotas'),
  ('quotas.manage', 'cuotas', 'Administrar cuotas'),
  ('analytics.read', 'analisis', 'Ver análisis y KPIs')
on conflict (key) do update
set module = excluded.module,
    description = excluded.description;

-- Admin: todos los permisos existentes.
insert into public.role_permissions (role, permission_key)
select 'admin'::public.app_role, p.key
from public.permissions p
on conflict do nothing;

-- Supervisor: operación diaria; no administra usuarios ni crea/edita tiendas.
insert into public.role_permissions (role, permission_key) values
  ('supervisor', 'stores.read'),
  ('supervisor', 'promoters.read'),
  ('supervisor', 'promoters.create'),
  ('supervisor', 'promoters.update'),
  ('supervisor', 'inventory.read'),
  ('supervisor', 'inventory.manage'),
  ('supervisor', 'sales.read'),
  ('supervisor', 'sales.create'),
  ('supervisor', 'schedules.read'),
  ('supervisor', 'schedules.manage'),
  ('supervisor', 'quotas.read'),
  ('supervisor', 'quotas.manage'),
  ('supervisor', 'analytics.read')
on conflict do nothing;

create trigger user_permissions_set_updated_at
before update on public.user_permissions
for each row execute function public.set_updated_at();

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

create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.current_permissions() cp
    where cp.permission_key = required_permission
  );
$$;

revoke all on function public.current_permissions() from public;
revoke all on function public.has_permission(text) from public;
grant execute on function public.current_permissions() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_permissions enable row level security;

revoke all on table public.permissions from anon, authenticated;
revoke all on table public.role_permissions from anon, authenticated;
revoke all on table public.user_permissions from anon, authenticated;

-- El permiso users.read controla el directorio completo; cada usuario conserva acceso propio.
drop policy if exists admins_can_read_profiles on public.profiles;
drop policy if exists authorized_users_can_read_profiles on public.profiles;
create policy authorized_users_can_read_profiles
on public.profiles
for select
to authenticated
using (public.has_permission('users.read'));

create policy authorized_users_can_update_profiles
on public.profiles
for update
to authenticated
using (public.has_permission('users.update'))
with check (public.has_permission('users.update'));

grant select, update on public.profiles to authenticated;

-- -----------------------------------------------------------------------------
-- Tiendas y asignación de supervisores.
-- -----------------------------------------------------------------------------
create table public.stores (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  city text,
  address text,
  is_active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.store_supervisors (
  store_id uuid not null references public.stores(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (store_id, user_id)
);

create trigger stores_set_updated_at
before update on public.stores
for each row execute function public.set_updated_at();

create trigger store_supervisors_set_updated_at
before update on public.store_supervisors
for each row execute function public.set_updated_at();

create or replace function public.can_access_store(target_store_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.is_active = true
      and (
        p.role = 'admin'::public.app_role
        or exists (
          select 1
          from public.store_supervisors ss
          where ss.user_id = p.id
            and ss.store_id = target_store_id
            and ss.is_active = true
        )
      )
  );
$$;

revoke all on function public.can_access_store(uuid) from public;
grant execute on function public.can_access_store(uuid) to authenticated;

alter table public.stores enable row level security;
alter table public.store_supervisors enable row level security;

create policy stores_select_allowed
on public.stores
for select
to authenticated
using (
  public.has_permission('stores.read')
  and public.can_access_store(id)
);

create policy stores_insert_allowed
on public.stores
for insert
to authenticated
with check (public.has_permission('stores.create'));

create policy stores_update_allowed
on public.stores
for update
to authenticated
using (
  public.has_permission('stores.update')
  and public.can_access_store(id)
)
with check (
  public.has_permission('stores.update')
  and public.can_access_store(id)
);

create policy store_supervisors_select_allowed
on public.store_supervisors
for select
to authenticated
using (
  user_id = auth.uid()
  or public.has_permission('stores.assign')
);

create policy store_supervisors_insert_allowed
on public.store_supervisors
for insert
to authenticated
with check (public.has_permission('stores.assign'));

create policy store_supervisors_update_allowed
on public.store_supervisors
for update
to authenticated
using (public.has_permission('stores.assign'))
with check (public.has_permission('stores.assign'));

create policy store_supervisors_delete_allowed
on public.store_supervisors
for delete
to authenticated
using (public.has_permission('stores.assign'));

grant select, insert, update on public.stores to authenticated;
grant select, insert, update, delete on public.store_supervisors to authenticated;

-- -----------------------------------------------------------------------------
-- Promotores.
-- -----------------------------------------------------------------------------
create table public.promoters (
  id uuid primary key default gen_random_uuid(),
  store_id uuid references public.stores(id) on delete set null,
  first_name text not null,
  last_name text not null,
  document text,
  phone text,
  email text,
  is_active boolean not null default true,
  hired_at date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index promoters_document_unique
on public.promoters (document)
where document is not null and btrim(document) <> '';

create index promoters_store_id_idx on public.promoters (store_id);

create trigger promoters_set_updated_at
before update on public.promoters
for each row execute function public.set_updated_at();

alter table public.promoters enable row level security;

create policy promoters_select_allowed
on public.promoters
for select
to authenticated
using (
  public.has_permission('promoters.read')
  and public.can_access_store(store_id)
);

create policy promoters_insert_allowed
on public.promoters
for insert
to authenticated
with check (
  public.has_permission('promoters.create')
  and public.can_access_store(store_id)
);

create policy promoters_update_allowed
on public.promoters
for update
to authenticated
using (
  public.has_permission('promoters.update')
  and public.can_access_store(store_id)
)
with check (
  public.has_permission('promoters.update')
  and public.can_access_store(store_id)
);

grant select, insert, update on public.promoters to authenticated;

-- Registra que todo el script terminó correctamente.
insert into public.app_sql_versions (version, name)
values (2, 'rbac_tiendas_promotores');

commit;

-- Verificaciones sugeridas:
-- select * from public.app_sql_versions order by version;
-- select * from public.current_permissions();
-- select role, permission_key from public.role_permissions order by role, permission_key;
-- select id, email, full_name, role, is_active from public.profiles order by created_at;
