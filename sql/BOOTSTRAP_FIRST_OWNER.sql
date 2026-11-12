-- MANUAL ONLY: execute in Supabase SQL Editor immediately after 018 and before 019.
-- It deliberately contains no UUID, email, password, or service credential.
-- Replace the placeholder only after independently confirming the selected Auth user
-- is verified and the persona belongs to that individual.
begin;
do $$
declare
  v_email text := 'REEMPLAZAR_CON_CORREO_VERIFICADO';
  v_user_id uuid;
  v_persona_id uuid;
  v_owner_count integer;
begin
  if v_email = 'REEMPLAZAR_CON_CORREO_VERIFICADO' then
    raise exception 'Replace REEMPLAZAR_CON_CORREO_VERIFICADO with the verified Auth email';
  end if;
  select id into v_user_id from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then raise exception 'No auth.users account exists for %', v_email; end if;
  if not exists (select 1 from auth.users where id = v_user_id and email_confirmed_at is not null) then
    raise exception 'The Auth account for % is not email-verified', v_email;
  end if;
  select id into v_persona_id from public.personas where lower(email) = lower(v_email);
  if v_persona_id is null then raise exception 'No public.personas record has email %; create/link the person first', v_email; end if;
  if exists (select 1 from public.user_profiles where user_id = v_user_id or persona_id = v_persona_id) then
    raise exception 'The Auth account or persona is already linked to user_profiles';
  end if;
  select count(*) into v_owner_count from public.user_profiles where role='owner' and is_active;
  if v_owner_count <> 0 then raise exception 'Bootstrap requires zero active Owners; found %', v_owner_count; end if;
  insert into public.user_profiles(user_id, persona_id, role, is_active, created_by)
  values(v_user_id, v_persona_id, 'owner', true, v_user_id);
end $$;
commit;
-- Verification: select user_id, persona_id, role, is_active from public.user_profiles where role='owner';
