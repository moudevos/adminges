-- AdminGes SQL 011
-- Cierra catálogos internos que no deben exponerse por la Data API.
-- Ejecutar manualmente en Supabase > SQL Editor DESPUÉS de 010.
-- Este archivo NO usa Supabase Migrations.

begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 10) then
    raise exception 'Primero debes ejecutar SQL 010';
  end if;

  if exists (select 1 from public.app_sql_versions where version = 11) then
    raise exception 'SQL 011 ya fue aplicado';
  end if;
end
$$;

alter table public.system_roles enable row level security;
revoke all on public.system_roles from anon, authenticated;

insert into public.app_sql_versions (version, name)
values (11, 'endurecimiento_catalogos');

commit;
