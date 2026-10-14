-- AdminGes - CUOTA MENSUAL POR CICLO COMERCIAL
-- Requiere: 011_cuota_diaria_tienda.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 11
  ) then
    raise exception 'Primero ejecuta 011_cuota_diaria_tienda.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 12
  ) then
    raise exception 'La version 012 ya fue aplicada';
  end if;
end
$$;

create table public.cuotas_ciclos_comerciales (
  id uuid primary key default gen_random_uuid(),
  fecha_inicio date not null,
  fecha_fin date not null,
  semanas smallint not null check (semanas in (4, 5)),
  dias_comerciales smallint not null check (dias_comerciales in (28, 35)),
  cuota_hhp_fp numeric(14,2) not null default 0 check (cuota_hhp_fp >= 0),
  cuota_hhp_mass numeric(14,2) not null default 0 check (cuota_hhp_mass >= 0),
  cuota_tabs numeric(14,2) not null default 0 check (cuota_tabs >= 0),
  cuota_acc numeric(14,2) not null default 0 check (cuota_acc >= 0),
  cuota_amt numeric(14,2) generated always as (
    cuota_hhp_fp + cuota_hhp_mass + cuota_tabs + cuota_acc
  ) stored,
  cuota_sc_plus numeric(14,2) not null default 0 check (cuota_sc_plus >= 0),
  cuota_laminas integer not null default 0 check (cuota_laminas >= 0),
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fecha_fin = fecha_inicio + (dias_comerciales - 1))
);

create index cuotas_ciclos_comerciales_fechas_idx
  on public.cuotas_ciclos_comerciales(fecha_inicio desc, fecha_fin desc);

create table public.cuotas_ciclo_personal (
  ciclo_id uuid not null
    references public.cuotas_ciclos_comerciales(id) on delete cascade,
  persona_id uuid not null
    references public.personas(id) on delete restrict,
  dias_planificados smallint not null check (dias_planificados >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (ciclo_id, persona_id)
);

create index cuotas_ciclo_personal_persona_idx
  on public.cuotas_ciclo_personal(persona_id, ciclo_id);

alter table public.cuotas_ciclos_comerciales enable row level security;
alter table public.cuotas_ciclo_personal enable row level security;

revoke all on table public.cuotas_ciclos_comerciales from anon, authenticated;
revoke all on table public.cuotas_ciclo_personal from anon, authenticated;

grant select, insert, update, delete
on public.cuotas_ciclos_comerciales to authenticated;

grant select, insert, update, delete
on public.cuotas_ciclo_personal to authenticated;

create policy cuotas_ciclos_select
on public.cuotas_ciclos_comerciales
for select to authenticated
using ((select auth.uid()) is not null);

create policy cuotas_ciclos_insert
on public.cuotas_ciclos_comerciales
for insert to authenticated
with check ((select auth.uid()) is not null);

create policy cuotas_ciclos_update
on public.cuotas_ciclos_comerciales
for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create policy cuotas_ciclos_delete
on public.cuotas_ciclos_comerciales
for delete to authenticated
using ((select auth.uid()) is not null);

create policy cuotas_ciclo_personal_select
on public.cuotas_ciclo_personal
for select to authenticated
using ((select auth.uid()) is not null);

create policy cuotas_ciclo_personal_insert
on public.cuotas_ciclo_personal
for insert to authenticated
with check ((select auth.uid()) is not null);

create policy cuotas_ciclo_personal_update
on public.cuotas_ciclo_personal
for update to authenticated
using ((select auth.uid()) is not null)
with check ((select auth.uid()) is not null);

create policy cuotas_ciclo_personal_delete
on public.cuotas_ciclo_personal
for delete to authenticated
using ((select auth.uid()) is not null);

create or replace function public.save_monthly_commercial_cycle(
  p_ciclo_id uuid,
  p_fecha_inicio date,
  p_semanas integer,
  p_cuota_hhp_fp numeric,
  p_cuota_hhp_mass numeric,
  p_cuota_tabs numeric,
  p_cuota_acc numeric,
  p_cuota_sc_plus numeric,
  p_cuota_laminas integer,
  p_personal jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_id uuid;
  v_dias integer;
  v_fin date;
  v_item jsonb;
  v_persona_id uuid;
  v_persona_dias integer;
  v_total_persona_dias integer := 0;
  v_seen uuid[] := array[]::uuid[];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_fecha_inicio is null or p_semanas not in (4, 5) then
    raise exception 'INVALID_COMMERCIAL_CYCLE';
  end if;

  v_dias := p_semanas * 7;
  v_fin := p_fecha_inicio + (v_dias - 1);

  if p_cuota_hhp_fp is null
    or p_cuota_hhp_mass is null
    or p_cuota_tabs is null
    or p_cuota_acc is null
    or p_cuota_sc_plus is null
    or p_cuota_laminas is null
    or p_cuota_hhp_fp < 0
    or p_cuota_hhp_mass < 0
    or p_cuota_tabs < 0
    or p_cuota_acc < 0
    or p_cuota_sc_plus < 0
    or p_cuota_laminas < 0
  then
    raise exception 'INVALID_MONTHLY_TARGETS';
  end if;

  if jsonb_typeof(p_personal) <> 'array'
    or jsonb_array_length(p_personal) = 0
  then
    raise exception 'MONTHLY_TEAM_REQUIRED';
  end if;

  if exists (
    select 1
    from public.cuotas_ciclos_comerciales c
    where (p_ciclo_id is null or c.id <> p_ciclo_id)
      and daterange(c.fecha_inicio, c.fecha_fin, '[]')
        && daterange(p_fecha_inicio, v_fin, '[]')
  ) then
    raise exception 'COMMERCIAL_CYCLE_OVERLAP';
  end if;

  if p_ciclo_id is null then
    insert into public.cuotas_ciclos_comerciales(
      fecha_inicio,
      fecha_fin,
      semanas,
      dias_comerciales,
      cuota_hhp_fp,
      cuota_hhp_mass,
      cuota_tabs,
      cuota_acc,
      cuota_sc_plus,
      cuota_laminas,
      created_by
    )
    values (
      p_fecha_inicio,
      v_fin,
      p_semanas,
      v_dias,
      round(p_cuota_hhp_fp, 2),
      round(p_cuota_hhp_mass, 2),
      round(p_cuota_tabs, 2),
      round(p_cuota_acc, 2),
      round(p_cuota_sc_plus, 2),
      p_cuota_laminas,
      auth.uid()
    )
    returning id into v_id;
  else
    update public.cuotas_ciclos_comerciales
    set
      fecha_inicio = p_fecha_inicio,
      fecha_fin = v_fin,
      semanas = p_semanas,
      dias_comerciales = v_dias,
      cuota_hhp_fp = round(p_cuota_hhp_fp, 2),
      cuota_hhp_mass = round(p_cuota_hhp_mass, 2),
      cuota_tabs = round(p_cuota_tabs, 2),
      cuota_acc = round(p_cuota_acc, 2),
      cuota_sc_plus = round(p_cuota_sc_plus, 2),
      cuota_laminas = p_cuota_laminas,
      updated_at = now()
    where id = p_ciclo_id;

    if not found then
      raise exception 'COMMERCIAL_CYCLE_NOT_FOUND';
    end if;

    v_id := p_ciclo_id;
    delete from public.cuotas_ciclo_personal where ciclo_id = v_id;
  end if;

  for v_item in
    select value from jsonb_array_elements(p_personal)
  loop
    begin
      v_persona_id := (v_item->>'persona_id')::uuid;
      v_persona_dias := (v_item->>'dias')::integer;
    exception
      when others then
        raise exception 'INVALID_MONTHLY_TEAM_MEMBER';
    end;

    if v_persona_id = any(v_seen) then
      raise exception 'DUPLICATE_MONTHLY_TEAM_MEMBER';
    end if;

    v_seen := array_append(v_seen, v_persona_id);

    if v_persona_dias < 0 or v_persona_dias > v_dias then
      raise exception 'INVALID_MONTHLY_PERSON_DAYS';
    end if;

    if not exists (
      select 1
      from public.personas p
      where p.id = v_persona_id
        and p.is_active = true
        and p.puede_vender = true
    ) then
      raise exception 'PERSON_NOT_ELIGIBLE_FOR_MONTHLY_QUOTA';
    end if;

    insert into public.cuotas_ciclo_personal(
      ciclo_id,
      persona_id,
      dias_planificados
    )
    values (
      v_id,
      v_persona_id,
      v_persona_dias
    );

    v_total_persona_dias := v_total_persona_dias + v_persona_dias;
  end loop;

  if v_total_persona_dias <= 0 then
    raise exception 'MONTHLY_TEAM_DAYS_REQUIRED';
  end if;

  return v_id;
end;
$function$;

revoke all on function public.save_monthly_commercial_cycle(
  uuid, date, integer, numeric, numeric, numeric, numeric, numeric, integer, jsonb
) from public;

grant execute on function public.save_monthly_commercial_cycle(
  uuid, date, integer, numeric, numeric, numeric, numeric, numeric, integer, jsonb
) to authenticated;

create or replace view public.ventas_metricas_comerciales
with (security_invoker = true)
as
with classified as (
  select
    v.id as venta_id,
    v.promotor_id,
    (v.fecha at time zone 'America/Lima')::date as fecha,
    vd.producto_id,
    vd.cantidad::integer as cantidad,
    vd.subtotal::numeric(14,2) as subtotal,
    public.sales_report_group(
      p.sku,
      p.nombre,
      coalesce(p.categoria_principal, p.categoria),
      p.categoria_venta,
      p.familia,
      p.variante
    ) as grupo_reporte,
    upper(
      concat_ws(
        ' ',
        p.categoria_principal,
        p.categoria,
        p.categoria_venta,
        p.familia,
        p.variante,
        p.nombre
      )
    ) as texto_clasificacion
  from public.venta_detalles vd
  join public.ventas v on v.id = vd.venta_id
  join public.productos p on p.id = vd.producto_id
  where v.estado = 'confirmada'
)
select
  venta_id,
  promotor_id,
  fecha,
  producto_id,
  cantidad,
  subtotal,
  grupo_reporte,
  case
    when grupo_reporte in ('HHP_SERIE_S', 'HHP_SERIE_Z') then 'HHP_FP'
    when grupo_reporte = 'HHP_SERIE_A' then 'HHP_MASS'
    when grupo_reporte = 'TABLETS' then 'TABS'
    when grupo_reporte in ('ACCESORIOS', 'WEA') then 'ACC'
    else 'OTROS'
  end as componente_amt,
  (
    texto_clasificacion like '%SC+%'
    or texto_clasificacion like '%SC PLUS%'
    or texto_clasificacion like '%SAMSUNG CARE%'
  ) as es_sc_plus,
  (grupo_reporte = 'LAMINAS') as es_lamina,
  (
    grupo_reporte in (
      'HHP_SERIE_A',
      'HHP_SERIE_S',
      'HHP_SERIE_Z',
      'TABLETS'
    )
  ) as es_hhp_tabs,
  (grupo_reporte = 'ACCESORIOS') as es_acc_sin_wea,
  (grupo_reporte = 'WEA') as es_wea
from classified;

grant select on public.ventas_metricas_comerciales to authenticated;

insert into public.app_sql_versions(version, name)
values (12, 'cuota_mensual_ciclo_comercial');

commit;
