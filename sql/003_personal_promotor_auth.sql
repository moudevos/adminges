-- AdminGes SQL 003
-- Unifica la gestión de Personal, habilita rol Promotor y vincula promotores con Supabase Auth.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 002.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 2) then
    raise exception 'Primero debes ejecutar SQL 002';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 3) then
    raise exception 'SQL 003 ya fue aplicado';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- Roles extensibles.
-- El enum inicial servía para Admin/Supervisor, pero dificulta agregar roles de
-- negocio. Desde esta versión almacenamos el rol como text + CHECK.
-- -----------------------------------------------------------------------------
drop function if exists public.current_user_role();

alter table public.profiles
  alter column role drop default;

alter table public.profiles
  alter column role type text using role::text;

alter table public.role_permissions
  alter column role type text using role::text;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('admin', 'supervisor', 'promotor'));

alter table public.role_permissions
  add constraint role_permissions_role_check
  check (role in ('admin', 'supervisor', 'promotor'));

alter table public.profiles
  alter column role set default 'supervisor';

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.profiles
  where id = auth.uid()
    and is_active = true
  limit 1;
$$;

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

-- El trigger de Auth debe escribir el nuevo tipo text.
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
    'supervisor'
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      email = excluded.email,
      updated_at = now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Promotor + Auth opcional.
-- -----------------------------------------------------------------------------
alter table public.promoters
  add column if not exists user_id uuid unique references public.profiles(id) on delete set null;

create index if not exists promoters_user_id_idx
  on public.promoters(user_id)
  where user_id is not null;

-- Acceso mínimo inicial del rol Promotor.
-- No administra Personal ni Tiendas.
insert into public.role_permissions (role, permission_key) values
  ('promotor', 'sales.read'),
  ('promotor', 'sales.create'),
  ('promotor', 'schedules.read'),
  ('promotor', 'quotas.read')
on conflict do nothing;

-- La función de alcance de tienda también reconoce la tienda del promotor autenticado.
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
        p.role = 'admin'
        or exists (
          select 1
          from public.store_supervisors ss
          where ss.user_id = p.id
            and ss.store_id = target_store_id
            and ss.is_active = true
        )
        or exists (
          select 1
          from public.promoters pr
          where pr.user_id = p.id
            and pr.store_id = target_store_id
            and pr.is_active = true
        )
      )
  );
$$;

revoke all on function public.can_access_store(uuid) from public;
grant execute on function public.can_access_store(uuid) to authenticated;

-- Un promotor autenticado puede consultar únicamente su propia ficha,
-- aunque no posea promoters.read.
drop policy if exists promoters_select_own_profile on public.promoters;
create policy promoters_select_own_profile
on public.promoters
for select
to authenticated
using (user_id = auth.uid());

insert into public.app_sql_versions (version, name)
values (3, 'personal_promotor_auth');

commit;

-- Verificación:
-- select version, name, applied_at from public.app_sql_versions order by version;
-- select id, first_name, last_name, user_id from public.promoters order by created_at desc;
-- select id, full_name, email, role from public.profiles order by created_at desc;
