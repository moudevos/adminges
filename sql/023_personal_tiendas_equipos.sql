-- Apply manually after 022. Adds store classification and an atomic Owner-only save RPC.
begin;
do $$ begin
 if not exists(select 1 from public.app_sql_versions where version=22) then raise exception 'Apply 022 first'; end if;
 if exists(select 1 from public.app_sql_versions where version=23) then raise exception 'SQL 023 already applied'; end if;
end $$;
alter table public.tiendas add column if not exists categoria text check (categoria in ('Oro','Plata','Bronce'));
alter table public.tiendas add column if not exists tipo text check (tipo in ('SES','KIOSKO'));
alter table public.tiendas alter column radio_metros set default 50;
alter table public.tiendas add column if not exists version integer not null default 1;
create index if not exists personas_documento_idx on public.personas(documento);
create index if not exists tienda_promotores_active_idx on public.tienda_promotores(tienda_id) where valid_to is null;
-- Category/type must be completed before enabling attendance geofencing for a new store.
create or replace function public.save_store_with_team(p_tienda_id uuid,p_codigo text,p_nombre text,p_direccion text,p_email text,p_zona_id uuid,p_latitude numeric,p_longitude numeric,p_radio_metros numeric,p_categoria text,p_tipo text,p_is_active boolean,p_supervisor_id uuid default null,p_promotores uuid[] default '{}') returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_promotor uuid; begin
 if not public.is_owner() then raise exception 'owner required'; end if;
 if p_latitude is not null and (p_latitude < -90 or p_latitude > 90) then raise exception 'invalid latitude'; end if;
 if p_longitude is not null and (p_longitude < -180 or p_longitude > 180) then raise exception 'invalid longitude'; end if;
 if p_radio_metros is not null and (p_radio_metros <= 0 or p_radio_metros > 10000) then raise exception 'invalid geofence radius'; end if;
 if p_categoria not in ('Oro','Plata','Bronce') or p_tipo not in ('SES','KIOSKO') then raise exception 'invalid category or type'; end if;
 insert into public.tiendas(id,codigo,nombre,direccion,email,zona_id,latitude,longitude,radio_metros,categoria,tipo,is_active) values(coalesce(p_tienda_id,gen_random_uuid()),p_codigo,p_nombre,p_direccion,p_email,p_zona_id,p_latitude,p_longitude,coalesce(p_radio_metros,50),p_categoria,p_tipo,p_is_active) on conflict(id) do update set codigo=excluded.codigo,nombre=excluded.nombre,direccion=excluded.direccion,email=excluded.email,zona_id=excluded.zona_id,latitude=excluded.latitude,longitude=excluded.longitude,radio_metros=excluded.radio_metros,categoria=excluded.categoria,tipo=excluded.tipo,is_active=excluded.is_active,version=public.tiendas.version+1,updated_at=now() returning id into v_id;
 if p_supervisor_id is not null then perform public.assign_supervisor_to_store(v_id,p_supervisor_id,current_date); end if;
 foreach v_promotor in array p_promotores loop perform public.assign_promoter_to_store(v_id,v_promotor,current_date,'Asignación desde tienda'); end loop;
 return v_id;
end $$;
revoke all on function public.save_store_with_team(uuid,text,text,text,text,uuid,numeric,numeric,numeric,text,text,boolean,uuid,uuid[]) from public;
grant execute on function public.save_store_with_team(uuid,text,text,text,text,uuid,numeric,numeric,numeric,text,text,boolean,uuid,uuid[]) to authenticated;
insert into public.app_sql_versions(version,name) values(23,'personal_tiendas_equipos');
commit;
