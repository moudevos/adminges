-- Apply manually after 026. Keeps Person and organizational authorization atomic.
begin;
create or replace function public.owner_save_person(p_persona_id uuid,p_puesto_id uuid,p_nombres text,p_apellidos text,p_documento text,p_telefono text,p_email text,p_puede_vender boolean,p_estado_laboral text,p_is_active boolean,p_role text default null) returns uuid language plpgsql security definer set search_path=public as $$ declare v_id uuid; v_puesto text; begin
 if not public.is_owner() then raise exception 'OWNER_REQUIRED'; end if;
 select lower(nombre) into v_puesto from public.puestos where id=p_puesto_id; if v_puesto is null then raise exception 'INVALID_POSITION'; end if;
 if p_role is not null and p_role not in ('zonal','supervisor') then raise exception 'INVALID_ROLE'; end if;
 if p_role is not null and p_role <> v_puesto then raise exception 'ROLE_POSITION_MISMATCH'; end if;
 insert into public.personas(id,puesto_id,nombres,apellidos,documento,telefono,email,puede_vender,estado_laboral,is_active) values(coalesce(p_persona_id,gen_random_uuid()),p_puesto_id,p_nombres,p_apellidos,nullif(p_documento,''),nullif(p_telefono,''),nullif(p_email,''),p_puede_vender,p_estado_laboral,p_is_active) on conflict(id) do update set puesto_id=excluded.puesto_id,nombres=excluded.nombres,apellidos=excluded.apellidos,documento=excluded.documento,telefono=excluded.telefono,email=excluded.email,puede_vender=excluded.puede_vender,estado_laboral=excluded.estado_laboral,is_active=excluded.is_active,updated_at=now() returning id into v_id;
 if p_role is null then update public.access_authorizations set is_active=false,revoked_at=now() where persona_id=v_id and is_active; else insert into public.access_authorizations(persona_id,role,is_active,authorized_by,authorized_at,revoked_at) values(v_id,p_role,p_is_active,auth.uid(),now(),case when p_is_active then null else now() end) on conflict(persona_id) do update set role=excluded.role,is_active=excluded.is_active,authorized_by=auth.uid(),authorized_at=now(),revoked_at=excluded.revoked_at; end if;
 return v_id; end $$;
revoke all on function public.owner_save_person(uuid,uuid,text,text,text,text,text,boolean,text,boolean,text) from public; grant execute on function public.owner_save_person(uuid,uuid,text,text,text,text,text,boolean,text,boolean,text) to authenticated;
insert into public.app_sql_versions(version,name) values(27,'personas_autorizaciones');
commit;
