-- MANUAL ONLY: execute after 018 and before 019 in Supabase SQL Editor.
-- Replace only v_email. No UUID, password, service key, or personal data is stored here.
-- If the account has no name in Auth metadata, this safely stops rather than inventing one.
begin;
do $$
declare
  v_email text := 'REEMPLAZAR_CON_CORREO_VERIFICADO';
  v_user_id uuid;
  v_persona_id uuid;
  v_puesto_id uuid;
  v_full_name text;
  v_nombres text;
  v_apellidos text;
  v_owner_count integer;
begin
  if v_email = 'REEMPLAZAR_CON_CORREO_VERIFICADO' then
    raise exception 'Replace REEMPLAZAR_CON_CORREO_VERIFICADO with the verified Auth email';
  end if;

  select id,
    nullif(trim(coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', '')), '')
  into v_user_id, v_full_name
  from auth.users where lower(email) = lower(v_email);
  if v_user_id is null then raise exception 'No auth.users account exists for %', v_email; end if;
  if not exists (select 1 from auth.users where id=v_user_id and email_confirmed_at is not null) then
    raise exception 'The Auth account for % is not email-verified', v_email;
  end if;

  select id into v_persona_id from public.personas where lower(email) = lower(v_email);
  if v_persona_id is null then
    if v_full_name is null then
      raise exception 'Auth metadata has no full_name/name for %. Add it or create the persona with real names first', v_email;
    end if;
    v_nombres := split_part(v_full_name, ' ', 1);
    v_apellidos := nullif(trim(substr(v_full_name, length(v_nombres) + 1)), '');
    if v_apellidos is null then raise exception 'Auth full name must include names and surnames'; end if;
    insert into public.puestos(nombre)
    select 'Administración'
    where not exists (select 1 from public.puestos where lower(nombre)='administración');
    select id into v_puesto_id from public.puestos where lower(nombre)='administración' limit 1;
    insert into public.personas(puesto_id,nombres,apellidos,email,is_active)
    values(v_puesto_id,v_nombres,v_apellidos,lower(v_email),true)
    returning id into v_persona_id;
  end if;

  if exists (select 1 from public.user_profiles where user_id=v_user_id or persona_id=v_persona_id) then
    raise exception 'The Auth account or persona is already linked to user_profiles';
  end if;
  select count(*) into v_owner_count from public.user_profiles where role='owner' and is_active;
  if v_owner_count <> 0 then raise exception 'Bootstrap requires zero active Owners; found %', v_owner_count; end if;
  insert into public.user_profiles(user_id,persona_id,role,is_active,created_by)
  values(v_user_id,v_persona_id,'owner',true,v_user_id);
end $$;
commit;

-- Verification (run separately):
-- select up.role, up.is_active, p.nombres, p.apellidos, p.email, pu.nombre as puesto
-- from public.user_profiles up join public.personas p on p.id=up.persona_id
-- join public.puestos pu on pu.id=p.puesto_id where up.role='owner';
