-- AdminGes SQL 001
-- Implementación inicial de autenticación, perfiles y roles.
-- Ejecutar manualmente en Supabase > SQL Editor.
-- Este archivo NO usa Supabase Migrations.

begin;

-- Registro simple de scripts SQL aplicados manualmente.
create table if not exists public.app_sql_versions (
  version integer primary key,
  name text not null,
  applied_at timestamptz not null default now()
);

alter table public.app_sql_versions enable row level security;
revoke all on table public.app_sql_versions from anon, authenticated;

-- Evita aplicar el mismo script dos veces por error.
do $$
begin
  if exists (
    select 1
    from public.app_sql_versions
    where version = 1
  ) then
    raise exception 'SQL 001 ya fue aplicado';
  end if;
end
$$;

-- Roles iniciales del sistema.
do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where t.typname = 'app_role'
      and n.nspname = 'public'
  ) then
    create type public.app_role as enum ('admin', 'supervisor');
  end if;
end
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.app_role not null default 'supervisor',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Cada usuario autenticado puede consultar su propio perfil.
create policy users_can_read_own_profile
on public.profiles
for select
to authenticated
using (id = auth.uid());

-- Devuelve el rol del usuario autenticado. Útil para las políticas RLS futuras.
create or replace function public.current_user_role()
returns public.app_role
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

-- Admin puede consultar todos los perfiles.
create policy admins_can_read_profiles
on public.profiles
for select
to authenticated
using (public.current_user_role() = 'admin'::public.app_role);

-- Crea el perfil automáticamente cuando Supabase Auth crea un usuario.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    'supervisor'::public.app_role
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Backfill para usuarios creados antes de ejecutar este SQL.
insert into public.profiles (id, full_name, role)
select
  u.id,
  u.raw_user_meta_data ->> 'full_name',
  'supervisor'::public.app_role
from auth.users u
on conflict (id) do nothing;

-- Mantiene updated_at automáticamente.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- Registra que el script terminó correctamente.
insert into public.app_sql_versions (version, name)
values (1, 'implementacion_auth_perfiles');

commit;

-- Verificación opcional después de ejecutar:
-- select * from public.app_sql_versions order by version;
-- select id, email, created_at from auth.users order by created_at desc;
-- select * from public.profiles order by created_at desc;
--
-- Para promover un usuario existente a admin desde SQL Editor:
-- update public.profiles
-- set role = 'admin'
-- where id = '<UUID_DEL_USUARIO>';
