-- MANUAL ONLY: execute in Supabase SQL Editor immediately after 018 and before 019.
-- It deliberately contains no UUID, email, password, or service credential.
-- Replace the placeholder only after independently confirming the selected auth user
-- is verified and the persona belongs to that individual.
begin;
insert into public.user_profiles(user_id, persona_id, role, is_active, created_by)
select u.id, p.id, 'owner', true, u.id
from auth.users u
join public.personas p on lower(p.email) = lower(u.email)
where u.email = 'REEMPLAZAR_CON_CORREO_VERIFICADO'
  and u.email_confirmed_at is not null
  and not exists (select 1 from public.user_profiles up where up.user_id = u.id)
  and not exists (select 1 from public.user_profiles up where up.persona_id = p.id);
do $$ begin
 if (select count(*) from public.user_profiles where role='owner' and is_active) <> 1 then
   raise exception 'Expected exactly one active Owner after bootstrap';
 end if;
end $$;
commit;
-- Verification: select user_id, persona_id, role, is_active from public.user_profiles where role='owner';
