-- AdminGes - CONFIGURACION DIARIA DE EQUIPO Y CUOTAS
-- Requiere: 005_registro_ventas_jornada.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 5
  ) then
    raise exception 'Primero ejecuta 005_registro_ventas_jornada.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 6
  ) then
    raise exception 'La version 006 ya fue aplicada';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Personal: capacidad de venta y estado laboral.
-- is_active indica si la persona sigue activa en la organización.
-- estado_laboral permite excluir temporalmente vacaciones sin desactivarla.
-- -----------------------------------------------------------------------------
alter table public.personas
  add column if not exists puede_vender boolean not null default false,
  add column if not exists estado_laboral text not null default 'activo'
    check (estado_laboral in ('activo', 'vacaciones'));

insert into public.puestos(nombre)
values ('Supervisor')
on conflict (nombre) do nothing;

update public.personas p
set puede_vender = true
from public.puestos pu
where pu.id = p.puesto_id
  and lower(trim(pu.nombre)) = 'promotor';

-- -----------------------------------------------------------------------------
-- 2. Jornada: cuotas y configuración de apertura.
-- AMT y SC+ son monetarios; Láminas se mide en unidades.
-- -----------------------------------------------------------------------------
alter table public.jornadas_venta
  add column if not exists configurada boolean not null default false,
  add column if not exists cuota_amt numeric(12,2) not null default 0
    check (cuota_amt >= 0),
  add column if not exists cuota_laminas integer not null default 0
    check (cuota_laminas >= 0),
  add column if not exists cuota_sc_plus numeric(12,2) not null default 0
    check (cuota_sc_plus >= 0);

alter table public.jornada_personal
  add column if not exists disponible boolean not null default false,
  add column if not exists vende_hoy boolean not null default false,
  add column if not exists hora_ingreso_programada time;

create index if not exists jornada_personal_disponible_idx
  on public.jornada_personal(jornada_id, disponible, vende_hoy);

-- -----------------------------------------------------------------------------
-- 3. Apertura/configuración del día.
-- p_equipo:
-- [
--   {
--     "persona_id": "uuid",
--     "hora_ingreso": "09:00",
--     "vende_hoy": true
--   }
-- ]
-- -----------------------------------------------------------------------------
drop function if exists public.open_sales_day(date);

create function public.open_sales_day(
  p_fecha date,
  p_cuota_amt numeric,
  p_cuota_laminas integer,
  p_cuota_sc_plus numeric,
  p_equipo jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_jornada_id uuid;
  v_estado text;
  v_configurada boolean;
  v_member jsonb;
  v_persona_id uuid;
  v_hora time;
  v_vende_hoy boolean;
  v_puede_vender boolean;
  v_is_active boolean;
  v_estado_laboral text;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_fecha <> (timezone('America/Lima', now()))::date then
    raise exception 'ONLY_CURRENT_DAY';
  end if;

  if p_cuota_amt is null
    or p_cuota_laminas is null
    or p_cuota_sc_plus is null
    or p_cuota_amt < 0
    or p_cuota_laminas < 0
    or p_cuota_sc_plus < 0
  then
    raise exception 'INVALID_DAILY_TARGETS';
  end if;

  if jsonb_typeof(p_equipo) <> 'array'
    or jsonb_array_length(p_equipo) = 0
  then
    raise exception 'DAILY_TEAM_REQUIRED';
  end if;

  select id, estado, configurada
  into v_jornada_id, v_estado, v_configurada
  from public.jornadas_venta
  where fecha = p_fecha
  limit 1
  for update;

  if v_jornada_id is not null then
    if v_estado = 'cerrada' then
      raise exception 'DAY_ALREADY_CLOSED';
    end if;

    if v_configurada then
      raise exception 'DAY_ALREADY_CONFIGURED';
    end if;
  else
    if exists (
      select 1
      from public.jornadas_venta
      where estado = 'abierta'
    ) then
      raise exception 'ANOTHER_DAY_OPEN';
    end if;

    insert into public.jornadas_venta(
      fecha,
      estado,
      configurada,
      cuota_amt,
      cuota_laminas,
      cuota_sc_plus
    )
    values (
      p_fecha,
      'abierta',
      false,
      0,
      0,
      0
    )
    returning id into v_jornada_id;
  end if;

  delete from public.jornada_personal
  where jornada_id = v_jornada_id;

  for v_member in
    select value from jsonb_array_elements(p_equipo)
  loop
    begin
      v_persona_id := (v_member->>'persona_id')::uuid;
      v_hora := (v_member->>'hora_ingreso')::time;
      v_vende_hoy := coalesce((v_member->>'vende_hoy')::boolean, false);
    exception
      when others then
        raise exception 'INVALID_TEAM_MEMBER';
    end;

    if v_hora < time '09:00'
      or v_hora > time '19:00'
    then
      raise exception 'INVALID_ENTRY_TIME';
    end if;

    if exists (
      select 1
      from public.jornada_personal
      where jornada_id = v_jornada_id
        and persona_id = v_persona_id
    ) then
      raise exception 'DUPLICATE_TEAM_MEMBER';
    end if;

    select puede_vender, is_active, estado_laboral
    into v_puede_vender, v_is_active, v_estado_laboral
    from public.personas
    where id = v_persona_id;

    if not found or not v_is_active then
      raise exception 'PERSON_NOT_ACTIVE';
    end if;

    if v_estado_laboral = 'vacaciones' then
      raise exception 'PERSON_ON_VACATION';
    end if;

    if v_vende_hoy and not v_puede_vender then
      raise exception 'PERSON_CANNOT_SELL';
    end if;

    insert into public.jornada_personal(
      jornada_id,
      persona_id,
      disponible,
      vende_hoy,
      hora_ingreso_programada,
      en_turno,
      inicio_turno,
      fin_turno,
      updated_at
    )
    values (
      v_jornada_id,
      v_persona_id,
      true,
      v_vende_hoy,
      v_hora,
      false,
      null,
      null,
      now()
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'DAILY_TEAM_REQUIRED';
  end if;

  update public.jornadas_venta
  set
    configurada = true,
    cuota_amt = round(p_cuota_amt, 2),
    cuota_laminas = p_cuota_laminas,
    cuota_sc_plus = round(p_cuota_sc_plus, 2)
  where id = v_jornada_id;

  return v_jornada_id;
end;
$function$;

revoke all on function public.open_sales_day(
  date, numeric, integer, numeric, jsonb
) from public;
grant execute on function public.open_sales_day(
  date, numeric, integer, numeric, jsonb
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Inicio/fin de turno: solo personal programado y disponible.
-- -----------------------------------------------------------------------------
create or replace function public.set_sales_shift(
  p_jornada_id uuid,
  p_persona_id uuid,
  p_en_turno boolean
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not exists (
    select 1
    from public.jornadas_venta
    where id = p_jornada_id
      and estado = 'abierta'
      and configurada = true
  ) then
    raise exception 'DAY_NOT_OPEN';
  end if;

  if not exists (
    select 1
    from public.jornada_personal jp
    join public.personas p on p.id = jp.persona_id
    where jp.jornada_id = p_jornada_id
      and jp.persona_id = p_persona_id
      and jp.disponible = true
      and p.is_active = true
      and p.estado_laboral = 'activo'
  ) then
    raise exception 'PERSON_NOT_AVAILABLE';
  end if;

  update public.jornada_personal
  set
    en_turno = p_en_turno,
    inicio_turno = case
      when p_en_turno and inicio_turno is null then now()
      else inicio_turno
    end,
    fin_turno = case
      when p_en_turno then null
      else now()
    end,
    updated_at = now()
  where jornada_id = p_jornada_id
    and persona_id = p_persona_id;
end;
$function$;

revoke all on function public.set_sales_shift(uuid, uuid, boolean) from public;
grant execute on function public.set_sales_shift(uuid, uuid, boolean)
to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Validación adicional para ventas.
-- Protege también inserciones directas que intenten saltar la UI.
-- -----------------------------------------------------------------------------
create or replace function public.validate_sale_seller()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if new.estado <> 'confirmada' or new.jornada_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.jornada_personal jp
    join public.jornadas_venta j on j.id = jp.jornada_id
    join public.personas p on p.id = jp.persona_id
    where jp.jornada_id = new.jornada_id
      and jp.persona_id = new.promotor_id
      and jp.disponible = true
      and jp.vende_hoy = true
      and jp.en_turno = true
      and j.estado = 'abierta'
      and j.configurada = true
      and p.is_active = true
      and p.estado_laboral = 'activo'
      and p.puede_vender = true
  ) then
    raise exception 'PERSON_NOT_ALLOWED_TO_SELL';
  end if;

  return new;
end;
$function$;

drop trigger if exists ventas_validate_seller
on public.ventas;

create trigger ventas_validate_seller
before insert or update of promotor_id, jornada_id, estado
on public.ventas
for each row
execute function public.validate_sale_seller();

-- -----------------------------------------------------------------------------
-- 6. Cierre: la jornada debe haber sido configurada con cuotas/equipo.
-- -----------------------------------------------------------------------------
create or replace function public.close_sales_day(p_jornada_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  update public.jornadas_venta
  set
    estado = 'cerrada',
    closed_at = now()
  where id = p_jornada_id
    and estado = 'abierta'
    and configurada = true;

  if not found then
    raise exception 'DAY_NOT_OPEN';
  end if;

  update public.jornada_personal
  set
    en_turno = false,
    fin_turno = coalesce(fin_turno, now()),
    updated_at = now()
  where jornada_id = p_jornada_id
    and en_turno = true;
end;
$function$;

revoke all on function public.close_sales_day(uuid) from public;
grant execute on function public.close_sales_day(uuid) to authenticated;

insert into public.app_sql_versions(version, name)
values (6, 'ventas_cuotas_equipo_diario');

commit;
