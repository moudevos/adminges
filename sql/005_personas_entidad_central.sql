-- AdminGes SQL 005
-- Convierte `promoters` en la entidad central `personas` para todos los roles.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 004.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 4) then
    raise exception 'Primero debes ejecutar SQL 004';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 5) then
    raise exception 'SQL 005 ya fue aplicado';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. La antigua tabla de promotores pasa a ser la tabla canónica de personas.
-- -----------------------------------------------------------------------------
alter table public.promoters rename to personas;

alter index public.promoters_document_unique rename to personas_document_unique;
alter index public.promoters_store_id_idx rename to personas_store_id_idx;
alter index public.promoters_user_id_idx rename to personas_user_id_idx;
alter trigger promoters_set_updated_at on public.personas rename to personas_set_updated_at;

alter table public.personas
  add column role text;

update public.personas
set role = 'promotor'
where role is null;

alter table public.personas
  alter column role set default 'promotor',
  alter column role set not null;

alter table public.personas
  add constraint personas_role_check
  check (role in ('admin', 'supervisor', 'promotor'));

-- -----------------------------------------------------------------------------
-- 2. Sincroniza personas ya vinculadas a Auth con el perfil actual.
-- -----------------------------------------------------------------------------
update public.personas pe
set
  role = p.role,
  first_name = coalesce(
    nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
    pe.first_name
  ),
  last_name = case
    when strpos(btrim(coalesce(p.full_name, '')), ' ') > 0
      then ltrim(substr(btrim(p.full_name), strpos(btrim(p.full_name), ' ') + 1))
    else pe.last_name
  end,
  document = coalesce(p.document, pe.document),
  phone = coalesce(p.phone, pe.phone),
  email = coalesce(p.email, pe.email),
  store_id = case
    when p.role = 'admin' then null
    when p.role = 'supervisor' then coalesce(
      (
        select ss.store_id
        from public.store_supervisors ss
        where ss.user_id = p.id
          and ss.is_active = true
        order by ss.created_at
        limit 1
      ),
      pe.store_id
    )
    else pe.store_id
  end,
  is_active = p.is_active,
  updated_at = now()
from public.profiles p
where pe.user_id = p.id;

-- -----------------------------------------------------------------------------
-- 3. Crea una Persona para cada Admin/Supervisor/Auth que todavía no la tenga.
-- -----------------------------------------------------------------------------
insert into public.personas (
  user_id,
  store_id,
  first_name,
  last_name,
  document,
  phone,
  email,
  role,
  is_active,
  created_by,
  created_at,
  updated_at
)
select
  p.id,
  case
    when p.role = 'supervisor' then (
      select ss.store_id
      from public.store_supervisors ss
      where ss.user_id = p.id
        and ss.is_active = true
      order by ss.created_at
      limit 1
    )
    else null
  end,
  coalesce(
    nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), ''),
    nullif(split_part(coalesce(p.email, ''), '@', 1), ''),
    'Persona'
  ),
  case
    when strpos(btrim(coalesce(p.full_name, '')), ' ') > 0
      then ltrim(substr(btrim(p.full_name), strpos(btrim(p.full_name), ' ') + 1))
    else ''
  end,
  p.document,
  p.phone,
  p.email,
  p.role,
  p.is_active,
  p.id,
  p.created_at,
  p.updated_at
from public.profiles p
where not exists (
  select 1
  from public.personas pe
  where pe.user_id = p.id
);

-- -----------------------------------------------------------------------------
-- 4. Alcance de tiendas utilizando la nueva tabla personas.
-- -----------------------------------------------------------------------------
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
          from public.personas pe
          where pe.user_id = p.id
            and pe.role = 'promotor'
            and pe.store_id = target_store_id
            and pe.is_active = true
        )
      )
  );
$$;

revoke all on function public.can_access_store(uuid) from public;
grant execute on function public.can_access_store(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. RLS para la entidad unificada.
-- Los permisos promoters.* siguen significando gestión de personas con rol promotor.
-- Los permisos users.* controlan Admin/Supervisor.
-- -----------------------------------------------------------------------------
drop policy if exists promoters_select_allowed on public.personas;
drop policy if exists promoters_insert_allowed on public.personas;
drop policy if exists promoters_update_allowed on public.personas;
drop policy if exists promoters_select_own_profile on public.personas;
drop policy if exists personas_select_allowed on public.personas;
drop policy if exists personas_insert_allowed on public.personas;
drop policy if exists personas_update_allowed on public.personas;

create policy personas_select_allowed
on public.personas
for select
to authenticated
using (
  user_id = auth.uid()
  or (
    role in ('admin', 'supervisor')
    and public.has_permission('users.read')
  )
  or (
    role = 'promotor'
    and public.has_permission('promoters.read')
    and public.can_access_store(store_id)
  )
);

create policy personas_insert_allowed
on public.personas
for insert
to authenticated
with check (
  (
    role in ('admin', 'supervisor')
    and public.has_permission('users.create')
  )
  or (
    role = 'promotor'
    and public.has_permission('promoters.create')
    and public.can_access_store(store_id)
  )
);

create policy personas_update_allowed
on public.personas
for update
to authenticated
using (
  (
    role in ('admin', 'supervisor')
    and public.has_permission('users.update')
  )
  or (
    role = 'promotor'
    and public.has_permission('promoters.update')
    and public.can_access_store(store_id)
  )
)
with check (
  (
    role in ('admin', 'supervisor')
    and public.has_permission('users.update')
  )
  or (
    role = 'promotor'
    and public.has_permission('promoters.update')
    and public.can_access_store(store_id)
  )
);

grant select, insert, update on public.personas to authenticated;

insert into public.app_sql_versions (version, name)
values (5, 'personas_entidad_central');

commit;

-- Verificación:
-- select version, name, applied_at from public.app_sql_versions order by version;
-- select id, user_id, first_name, last_name, role, document, phone, email, store_id, is_active
-- from public.personas order by created_at;