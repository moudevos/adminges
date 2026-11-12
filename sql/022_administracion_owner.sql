-- Ejecutar manualmente después de 018, 019, 020 y 021. No ejecutar desde la aplicación.
begin;
do $$ begin
 if not exists(select 1 from public.app_sql_versions where version=18) then raise exception 'Apply 018 first'; end if;
 if exists(select 1 from public.app_sql_versions where version=22) then raise exception 'SQL 022 already applied'; end if;
end $$;

create table if not exists public.admin_audit_log (
 id uuid primary key default gen_random_uuid(), actor_id uuid references auth.users(id), action text not null, entity_type text not null,
 entity_id uuid, before_data jsonb, after_data jsonb, created_at timestamptz not null default now()
);
alter table public.admin_audit_log enable row level security;
create policy admin_audit_owner on public.admin_audit_log for select to authenticated using ((select public.is_owner()));

-- Incremental invariant: each zone has one current responsible zonal.
create unique index if not exists zona_single_active_zonal_unique on public.zona_zonales(zona_id) where valid_to is null;

-- Each operation closes its active relation before adding a new historical row.
create or replace function public.assign_zonal_to_zone(p_zona_id uuid,p_user_id uuid,p_effective_date date default current_date) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner() then raise exception 'owner required'; end if;
 if p_effective_date < current_date then raise exception 'effective date cannot be in the past'; end if;
 if not exists(select 1 from public.user_profiles where user_id=p_user_id and role='zonal' and is_active) then raise exception 'active zonal required'; end if;
 update public.zona_zonales set valid_to=p_effective_date-1 where zona_id=p_zona_id and valid_to is null;
 insert into public.zona_zonales(zona_id,user_id,valid_from) values(p_zona_id,p_user_id,p_effective_date);
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_data) values(auth.uid(),'assign','zona',p_zona_id,jsonb_build_object('user_id',p_user_id));
end $$;
create or replace function public.assign_supervisor_to_store(p_tienda_id uuid,p_user_id uuid,p_effective_date date default current_date) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner() then raise exception 'owner required'; end if;
 if p_effective_date < current_date then raise exception 'effective date cannot be in the past'; end if;
 if not exists(select 1 from public.user_profiles where user_id=p_user_id and role='supervisor' and is_active) then raise exception 'active supervisor required'; end if;
 update public.tienda_supervisores set valid_to=p_effective_date-1 where tienda_id=p_tienda_id and valid_to is null;
 insert into public.tienda_supervisores(tienda_id,user_id,valid_from) values(p_tienda_id,p_user_id,p_effective_date);
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_data) values(auth.uid(),'assign','tienda',p_tienda_id,jsonb_build_object('user_id',p_user_id));
end $$;
create or replace function public.assign_promoter_to_store(p_tienda_id uuid,p_persona_id uuid,p_effective_date date default current_date,p_motivo text default null) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner() then raise exception 'owner required'; end if;
 if p_effective_date < current_date then raise exception 'effective date cannot be in the past'; end if;
 update public.tienda_promotores set valid_to=p_effective_date-1 where persona_id=p_persona_id and valid_to is null;
 insert into public.tienda_promotores(tienda_id,persona_id,valid_from,motivo,changed_by) values(p_tienda_id,p_persona_id,p_effective_date,p_motivo,auth.uid());
 insert into public.admin_audit_log(actor_id,action,entity_type,entity_id,after_data) values(auth.uid(),'transfer','persona',p_persona_id,jsonb_build_object('tienda_id',p_tienda_id));
end $$;
revoke all on function public.assign_zonal_to_zone(uuid,uuid,date) from public;
revoke all on function public.assign_supervisor_to_store(uuid,uuid,date) from public;
revoke all on function public.assign_promoter_to_store(uuid,uuid,date,text) from public;
grant execute on function public.assign_zonal_to_zone(uuid,uuid,date), public.assign_supervisor_to_store(uuid,uuid,date), public.assign_promoter_to_store(uuid,uuid,date,text) to authenticated;
insert into public.app_sql_versions(version,name) values(22,'administracion_owner');
commit;
