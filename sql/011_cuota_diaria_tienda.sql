-- AdminGes - CUOTA DIARIA DE TIENDA
-- Requiere: 010_cierre_formal_reporte_dia_venta.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 10
  ) then
    raise exception 'Primero ejecuta 010_cierre_formal_reporte_dia_venta.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 11
  ) then
    raise exception 'La version 011 ya fue aplicada';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Cuota diaria única de tienda.
-- La jornada guarda su propio snapshot cuando se abre.
-- -----------------------------------------------------------------------------
create table public.cuotas_tienda_diarias (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  cuota_amt numeric(12,2) not null check (cuota_amt >= 0),
  cuota_laminas integer not null check (cuota_laminas >= 0),
  cuota_sc_plus numeric(12,2) not null check (cuota_sc_plus >= 0),
  origen text not null default 'manual'
    check (origen in ('manual', 'apertura')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index cuotas_tienda_diarias_fecha_idx
  on public.cuotas_tienda_diarias(fecha desc);

alter table public.cuotas_tienda_diarias enable row level security;

create policy cuotas_tienda_diarias_authenticated_all
on public.cuotas_tienda_diarias
for all
to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

grant select, insert, update, delete
on public.cuotas_tienda_diarias to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Backfill de jornadas ya configuradas.
-- -----------------------------------------------------------------------------
insert into public.cuotas_tienda_diarias(
  fecha,
  cuota_amt,
  cuota_laminas,
  cuota_sc_plus,
  origen
)
select
  j.fecha,
  j.cuota_amt,
  j.cuota_laminas,
  j.cuota_sc_plus,
  'apertura'
from public.jornadas_venta j
where j.configurada = true
on conflict (fecha) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Guardado manual seguro.
-- Una cuota deja de ser editable cuando ya fue aplicada a una jornada.
-- -----------------------------------------------------------------------------
create or replace function public.save_daily_store_quota(
  p_fecha date,
  p_cuota_amt numeric,
  p_cuota_laminas integer,
  p_cuota_sc_plus numeric
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_fecha is null
    or p_cuota_amt is null
    or p_cuota_laminas is null
    or p_cuota_sc_plus is null
    or p_cuota_amt < 0
    or p_cuota_laminas < 0
    or p_cuota_sc_plus < 0
  then
    raise exception 'INVALID_DAILY_TARGETS';
  end if;

  if exists (
    select 1
    from public.jornadas_venta
    where fecha = p_fecha
      and configurada = true
  ) then
    raise exception 'QUOTA_DAY_LOCKED';
  end if;

  insert into public.cuotas_tienda_diarias(
    fecha,
    cuota_amt,
    cuota_laminas,
    cuota_sc_plus,
    origen,
    updated_at
  )
  values (
    p_fecha,
    round(p_cuota_amt, 2),
    p_cuota_laminas,
    round(p_cuota_sc_plus, 2),
    'manual',
    now()
  )
  on conflict (fecha) do update
  set
    cuota_amt = excluded.cuota_amt,
    cuota_laminas = excluded.cuota_laminas,
    cuota_sc_plus = excluded.cuota_sc_plus,
    origen = 'manual',
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.save_daily_store_quota(
  date, numeric, integer, numeric
) from public;

grant execute on function public.save_daily_store_quota(
  date, numeric, integer, numeric
) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Toda apertura/configuración sincroniza la cuota central.
-- Esto cubre también una cuota digitada directamente en el modal de apertura.
-- -----------------------------------------------------------------------------
create or replace function public.sync_store_daily_quota_from_journey()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  if new.configurada = true then
    insert into public.cuotas_tienda_diarias(
      fecha,
      cuota_amt,
      cuota_laminas,
      cuota_sc_plus,
      origen,
      updated_at
    )
    values (
      new.fecha,
      new.cuota_amt,
      new.cuota_laminas,
      new.cuota_sc_plus,
      'apertura',
      now()
    )
    on conflict (fecha) do update
    set
      cuota_amt = excluded.cuota_amt,
      cuota_laminas = excluded.cuota_laminas,
      cuota_sc_plus = excluded.cuota_sc_plus,
      origen = case
        when public.cuotas_tienda_diarias.origen = 'manual'
          then 'manual'
        else 'apertura'
      end,
      updated_at = now();
  end if;

  return new;
end;
$function$;

drop trigger if exists jornadas_venta_sync_daily_quota
on public.jornadas_venta;

create trigger jornadas_venta_sync_daily_quota
after insert or update of configurada, cuota_amt, cuota_laminas, cuota_sc_plus
on public.jornadas_venta
for each row
execute function public.sync_store_daily_quota_from_journey();

insert into public.app_sql_versions(version, name)
values (11, 'cuota_diaria_tienda');

commit;
