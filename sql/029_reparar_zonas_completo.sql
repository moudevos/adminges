-- Apply manually when 026/028 were partially applied. Additive repair only.
begin;
alter table public.zona_zonales add column if not exists persona_id uuid references public.personas(id) on delete restrict;
alter table public.zona_zonales alter column user_id drop not null;
update public.zona_zonales z set persona_id=p.persona_id from public.user_profiles p where z.persona_id is null and z.user_id=p.user_id;
create index if not exists zona_zonales_persona_idx on public.zona_zonales(persona_id,valid_from desc);
create or replace function public.owner_save_zone(p_zona_id uuid,p_codigo text,p_descripcion text,p_encargado_persona_id uuid) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$ declare v_id uuid; v_user uuid; begin
 if not public.is_owner() then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
 p_codigo:=upper(btrim(coalesce(p_codigo,''))); p_descripcion:=btrim(coalesce(p_descripcion,''));
 if length(p_codigo)=0 or length(p_codigo)>30 or length(p_descripcion)=0 or length(p_descripcion)>500 then raise exception 'INVALID_ZONE_DATA'; end if;
 if not exists(select 1 from public.personas p join public.puestos pu on pu.id=p.puesto_id where p.id=p_encargado_persona_id and p.is_active and lower(btrim(pu.nombre))='zonal' and (exists(select 1 from public.access_authorizations a where a.persona_id=p.id and a.role='zonal' and a.is_active and a.revoked_at is null) or exists(select 1 from public.user_profiles u where u.persona_id=p.id and u.role='zonal' and u.is_active))) then raise exception 'INVALID_ZONE_MANAGER'; end if;
 if p_zona_id is null then insert into public.zonas(codigo,nombre,descripcion,is_active) values(p_codigo,p_descripcion,p_descripcion,true) returning id into v_id; else update public.zonas set codigo=p_codigo,nombre=p_descripcion,descripcion=p_descripcion,updated_at=now() where id=p_zona_id returning id into v_id; if v_id is null then raise exception 'ZONE_NOT_FOUND'; end if; end if;
 update public.zona_zonales set valid_to=current_date where zona_id=v_id and valid_to is null and persona_id is distinct from p_encargado_persona_id;
 select user_id into v_user from public.user_profiles where persona_id=p_encargado_persona_id and role='zonal' and is_active limit 1;
 if not exists(select 1 from public.zona_zonales where zona_id=v_id and persona_id=p_encargado_persona_id and valid_to is null) then insert into public.zona_zonales(zona_id,persona_id,user_id,valid_from) values(v_id,p_encargado_persona_id,v_user,current_date); end if;
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_data) values(auth.uid(),case when p_zona_id is null then 'create' else 'update' end,'zona',v_id,jsonb_build_object('codigo',p_codigo,'encargado_persona_id',p_encargado_persona_id));
 return v_id; exception when unique_violation then raise exception 'ZONE_CODE_DUPLICATE'; end $$;
revoke all on function public.owner_save_zone(uuid,text,text,uuid) from public;
grant execute on function public.owner_save_zone(uuid,text,text,uuid) to authenticated;
insert into public.app_sql_versions(version,name) values(29,'reparar_zonas_completo') on conflict (version) do nothing;
notify pgrst,'reload schema';
commit;
