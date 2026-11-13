-- Apply manually after 023. Authorization is owned by Owner, never the public registration form.
begin;
create table public.access_authorizations (persona_id uuid primary key references public.personas(id) on delete restrict, role text not null check(role in ('zonal','supervisor')), is_active boolean not null default true, authorized_by uuid references auth.users(id), authorized_at timestamptz not null default now(), revoked_at timestamptz);
alter table public.access_authorizations enable row level security;
create policy access_authorizations_owner on public.access_authorizations for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create or replace function public.registration_eligible(p_documento text,p_email text) returns boolean language sql security definer set search_path=public as $$ select exists(select 1 from public.personas p join public.access_authorizations a on a.persona_id=p.id and a.is_active and a.revoked_at is null where p.documento=p_documento and lower(p.email)=lower(p_email) and p.is_active) $$;
revoke all on function public.registration_eligible(text,text) from public; grant execute on function public.registration_eligible(text,text) to anon, authenticated;
create or replace function public.complete_self_registration() returns void language plpgsql security definer set search_path=public as $$
declare p_id uuid; r text; begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select p.id,a.role into p_id,r from auth.users u join public.personas p on lower(p.email)=lower(u.email) join public.access_authorizations a on a.persona_id=p.id and a.is_active and a.revoked_at is null where u.id=auth.uid() and u.email_confirmed_at is not null and p.is_active;
 if p_id is null then raise exception 'registration not authorized'; end if;
 if exists(select 1 from public.user_profiles where persona_id=p_id or user_id=auth.uid()) then raise exception 'account already linked'; end if;
 insert into public.user_profiles(user_id,persona_id,role,is_active,created_by) values(auth.uid(),p_id,r,true,null);
end $$;
revoke all on function public.complete_self_registration() from public; grant execute on function public.complete_self_registration() to authenticated;
insert into public.app_sql_versions(version,name) values(24,'autoregistro_personas');
commit;
