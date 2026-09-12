-- AdminGes SQL 004
-- Datos personales comunes para todos los roles.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 003.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 3) then
    raise exception 'Primero debes ejecutar SQL 003';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 4) then
    raise exception 'SQL 004 ya fue aplicado';
  end if;
end
$$;

-- Documento y teléfono pertenecen a la persona, no a un rol específico.
alter table public.profiles
  add column if not exists document text,
  add column if not exists phone text;

-- Recupera datos ya registrados en promotores vinculados a una cuenta Auth.
update public.profiles p
set
  document = coalesce(p.document, pr.document),
  phone = coalesce(p.phone, pr.phone),
  updated_at = now()
from public.promoters pr
where pr.user_id = p.id
  and (
    (p.document is null and pr.document is not null)
    or (p.phone is null and pr.phone is not null)
  );

-- Evita documentos duplicados cuando el dato existe.
create unique index if not exists profiles_document_unique_idx
  on public.profiles(document)
  where document is not null and btrim(document) <> '';

insert into public.app_sql_versions (version, name)
values (4, 'datos_personales_comunes');

commit;

-- Verificación:
-- select version, name, applied_at from public.app_sql_versions order by version;
-- select id, full_name, email, role, document, phone from public.profiles order by created_at desc;