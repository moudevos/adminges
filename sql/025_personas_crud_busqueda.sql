-- Apply manually after 024. Non-destructive Persona CRUD support.
begin;
alter table public.personas add column if not exists tipo_documento text;
alter table public.personas add column if not exists celular_corporativo text;
alter table public.personas add constraint personas_tipo_documento_check check (tipo_documento is null or tipo_documento in ('DNI','CE','Pasaporte'));
alter table public.personas add constraint personas_dni_check check (tipo_documento is distinct from 'DNI' or documento ~ '^[0-9]{8}$');
create extension if not exists pg_trgm;
create index if not exists personas_nombre_trgm_idx on public.personas using gin ((nombres || ' ' || apellidos) gin_trgm_ops);
create index if not exists personas_contacto_idx on public.personas(telefono,celular_corporativo) where is_active;
create index if not exists personas_listado_idx on public.personas(is_active,puesto_id,estado_laboral,apellidos,nombres,id);
drop policy if exists personas_authenticated_all on public.personas;
create policy personas_owner_all on public.personas for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
insert into public.puestos(nombre) select 'Zonal' where not exists(select 1 from public.puestos where lower(nombre)='zonal');
insert into public.app_sql_versions(version,name) values(25,'personas_crud_busqueda');
commit;
