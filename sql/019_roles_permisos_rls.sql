-- Ejecutar solo tras crear el primer Owner mediante SQL Editor con user_id verificado.
begin;
do $$ begin if not exists(select 1 from public.app_sql_versions where version=18) then raise exception 'Apply 018 first'; end if; if exists(select 1 from public.app_sql_versions where version=19) then raise exception 'SQL 019 already applied'; end if; end $$;
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.user_profiles where user_id=auth.uid() and role='owner' and is_active) $$;
revoke all on function public.is_owner() from public; grant execute on function public.is_owner() to authenticated;
create policy owner_profiles on public.user_profiles for all to authenticated using ((select public.is_owner()) or user_id=(select auth.uid())) with check ((select public.is_owner()));
create policy org_owner_read on public.zonas for select to authenticated using ((select public.is_owner()));
create policy org_owner_write on public.zonas for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy stores_owner_read on public.tiendas for select to authenticated using ((select public.is_owner()));
create policy stores_owner_write on public.tiendas for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
insert into public.app_sql_versions(version,name) values(19,'roles_permisos_rls');
commit;
