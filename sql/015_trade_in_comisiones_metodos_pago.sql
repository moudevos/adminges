-- AdminGes · Trade-in por unidades, configuración de métodos y cuota mensual
-- Requiere 013_cuotas_ar_eco_pct_laminas_monto.sql.
-- Ejecutar manualmente una sola vez desde Supabase SQL Editor.
begin;

do $$
begin
  if not exists (select 1 from public.app_sql_versions where version = 13) then
    raise exception 'Primero ejecuta 013_cuotas_ar_eco_pct_laminas_monto.sql';
  end if;
  if exists (select 1 from public.app_sql_versions where version = 15) then
    raise exception 'La version 015 ya fue aplicada';
  end if;
end $$;

-- Conserva IDs, códigos, estado activo y pagos históricos de todos los métodos.
alter table public.metodos_pago
  add column es_trade_in boolean not null default false;

-- Si ya existe Trade in como método personalizado, se reutiliza.
update public.metodos_pago
set es_trade_in = true
where id = (
  select id
  from public.metodos_pago
  where codigo in ('trade_in', 'tradein', 'trade-in')
     or lower(regexp_replace(trim(nombre), '[^a-zA-Z0-9]', '', 'g')) = 'tradein'
  order by case when codigo = 'trade_in' then 0 else 1 end, created_at
  limit 1
);

-- Si no existe aún, se añade sin afectar las formas de pago preexistentes.
insert into public.metodos_pago(
  codigo, nombre, is_active, requiere_referencia, sort_order, is_system,
  es_trade_in
)
select
  'trade_in', 'Trade In', true, true,
  coalesce((select max(sort_order) + 10 from public.metodos_pago), 60),
  true, true
where not exists (
  select 1 from public.metodos_pago where es_trade_in = true
);

create unique index metodos_pago_unico_trade_in
on public.metodos_pago(es_trade_in)
where es_trade_in = true;

-- La cuota de Trade-in es una meta ENTERA de unidades HHP FP con ese medio.
alter table public.cuotas_ciclos_comerciales
  add column cuota_trade_in_unds integer not null default 0
  check (cuota_trade_in_unds >= 0);

-- Envoltura ATÓMICA: conserva el RPC original para compatibilidad.
-- La actualización de cuota en unidades se revierte si falla el guardado.
create function public.save_monthly_commercial_cycle_with_trade_in(
  p_ciclo_id uuid,
  p_fecha_inicio date,
  p_semanas integer,
  p_cuota_hhp_fp numeric,
  p_cuota_hhp_mass numeric,
  p_cuota_tabs numeric,
  p_cuota_acc numeric,
  p_cuota_sc_plus numeric,
  p_cuota_laminas numeric,
  p_cuota_ar_pct numeric,
  p_cuota_eco_pct numeric,
  p_cuota_trade_in_unds integer,
  p_personal jsonb
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
  if p_cuota_trade_in_unds is null or p_cuota_trade_in_unds < 0 then
    raise exception 'INVALID_TRADE_IN_TARGET';
  end if;

  v_id := public.save_monthly_commercial_cycle(
    p_ciclo_id,
    p_fecha_inicio, p_semanas,
    p_cuota_hhp_fp, p_cuota_hhp_mass, p_cuota_tabs, p_cuota_acc,
    p_cuota_sc_plus, p_cuota_laminas,
    p_cuota_ar_pct, p_cuota_eco_pct, p_personal
  );

  update public.cuotas_ciclos_comerciales
    set cuota_trade_in_unds = p_cuota_trade_in_unds
  where id = v_id;

  if not found then
    raise exception 'COMMERCIAL_CYCLE_NOT_FOUND';
  end if;
  return v_id;
end;
$function$;

revoke all on function public.save_monthly_commercial_cycle_with_trade_in(
  uuid, date, integer, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, integer, jsonb
) from public;

grant execute on function public.save_monthly_commercial_cycle_with_trade_in(
  uuid, date, integer, numeric, numeric, numeric, numeric, numeric, numeric,
  numeric, numeric, integer, jsonb
) to authenticated;

insert into public.app_sql_versions(version, name)
values (15, 'trade_in_comisiones_metodos_pago');

commit;
