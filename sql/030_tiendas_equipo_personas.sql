-- Ejecutar manualmente después de 029. No ejecutar desde la aplicación.
-- Modelo de equipo por persona_id; conserva las columnas user_id históricas.
begin;
do $$ begin
 if not exists(select 1 from public.app_sql_versions where version=29) then raise exception 'SQL_029_REQUIRED'; end if;
 if exists(select 1 from public.app_sql_versions where version=30) then raise exception 'SQL_030_ALREADY_APPLIED'; end if;
end $$;

alter table public.tienda_supervisores add column if not exists persona_id uuid references public.personas(id) on delete restrict;
alter table public.tienda_promotores add column if not exists ended_at timestamptz;
alter table public.tienda_supervisores alter column user_id drop not null;
update public.tienda_supervisores ts set persona_id=up.persona_id from public.user_profiles up where ts.persona_id is null and ts.user_id=up.user_id;
create index if not exists tienda_supervisores_persona_idx on public.tienda_supervisores(persona_id,valid_from desc);

create or replace function public.owner_save_store_team(
 p_tienda_id uuid,p_codigo text,p_nombre text,p_direccion text,p_email text,p_zona_id uuid,
 p_latitude numeric,p_longitude numeric,p_radio_metros numeric,p_categoria text,p_tipo text,
 p_is_active boolean,p_supervisor_persona_id uuid,p_promotores uuid[] default '{}'
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid; v_persona uuid; begin
 if not public.is_owner() then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
 if p_categoria not in ('Oro','Plata','Bronce') or p_tipo not in ('SES','KIOSKO') then raise exception 'INVALID_STORE_CLASSIFICATION'; end if;
 if p_latitude is not null and (p_latitude<-90 or p_latitude>90) then raise exception 'INVALID_LATITUDE'; end if;
 if p_longitude is not null and (p_longitude<-180 or p_longitude>180) then raise exception 'INVALID_LONGITUDE'; end if;
 if coalesce(p_radio_metros,50)<=0 or coalesce(p_radio_metros,50)>10000 then raise exception 'INVALID_GEOFENCE_RADIUS'; end if;
 if not exists(select 1 from public.zonas where id=p_zona_id and is_active) then raise exception 'INVALID_ZONE'; end if;
 if p_supervisor_persona_id is not null and not exists(select 1 from public.personas p join public.puestos pu on pu.id=p.puesto_id where p.id=p_supervisor_persona_id and p.is_active and lower(pu.nombre)='supervisor') then raise exception 'INVALID_SUPERVISOR'; end if;
 if exists(select 1 from unnest(coalesce(p_promotores,'{}'::uuid[])) x group by x having count(*)>1) then raise exception 'DUPLICATE_PROMOTER'; end if;
 if exists(select 1 from unnest(coalesce(p_promotores,'{}'::uuid[])) x join public.personas p on p.id=x join public.puestos pu on pu.id=p.puesto_id where not p.is_active or lower(pu.nombre)<>'promotor') then raise exception 'INVALID_PROMOTER'; end if;
 insert into public.tiendas(id,codigo,nombre,direccion,email,zona_id,latitude,longitude,radio_metros,categoria,tipo,is_active) values(coalesce(p_tienda_id,gen_random_uuid()),p_codigo,p_nombre,p_direccion,p_email,p_zona_id,p_latitude,p_longitude,coalesce(p_radio_metros,50),p_categoria,p_tipo,p_is_active) on conflict(id) do update set codigo=excluded.codigo,nombre=excluded.nombre,direccion=excluded.direccion,email=excluded.email,zona_id=excluded.zona_id,latitude=excluded.latitude,longitude=excluded.longitude,radio_metros=excluded.radio_metros,categoria=excluded.categoria,tipo=excluded.tipo,is_active=excluded.is_active,version=public.tiendas.version+1,updated_at=now() returning id into v_id;
 update public.tienda_supervisores set valid_to=current_date where tienda_id=v_id and valid_to is null and persona_id is distinct from p_supervisor_persona_id;
 if p_supervisor_persona_id is not null and not exists(select 1 from public.tienda_supervisores where tienda_id=v_id and persona_id=p_supervisor_persona_id and valid_to is null) then insert into public.tienda_supervisores(tienda_id,persona_id,valid_from) values(v_id,p_supervisor_persona_id,current_date); end if;
 update public.tienda_promotores set valid_to=current_date,ended_at=clock_timestamp() where tienda_id=v_id and valid_to is null and not(persona_id=any(coalesce(p_promotores,'{}'::uuid[])));
 foreach v_persona in array coalesce(p_promotores,'{}'::uuid[]) loop
  update public.tienda_promotores set valid_to=current_date,ended_at=clock_timestamp() where persona_id=v_persona and tienda_id<>v_id and valid_to is null;
  if not exists(select 1 from public.tienda_promotores where tienda_id=v_id and persona_id=v_persona and valid_to is null) then insert into public.tienda_promotores(tienda_id,persona_id,valid_from,motivo,changed_by) values(v_id,v_persona,current_date,'Asignación desde Tiendas',auth.uid()); end if;
 end loop;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_data) values(auth.uid(),case when p_tienda_id is null then 'create' else 'update' end,'tienda',v_id,jsonb_build_object('supervisor_persona_id',p_supervisor_persona_id,'promotores',p_promotores));
 return v_id; end $$;
revoke all on function public.owner_save_store_team(uuid,text,text,text,text,uuid,numeric,numeric,numeric,text,text,boolean,uuid,uuid[]) from public;
grant execute on function public.owner_save_store_team(uuid,text,text,text,text,uuid,numeric,numeric,numeric,text,text,boolean,uuid,uuid[]) to authenticated;
insert into public.app_sql_versions(version,name) values(30,'tiendas_equipo_personas');
notify pgrst,'reload schema';
commit;
