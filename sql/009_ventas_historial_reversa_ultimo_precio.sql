-- AdminGes - HISTORICO DE VENTAS, ULTIMO PRECIO Y REVERSA
-- Requiere: 008_metodos_pago_configurables.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 8
  ) then
    raise exception 'Primero ejecuta 008_metodos_pago_configurables.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 9
  ) then
    raise exception 'La version 009 ya fue aplicada';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Auditoria de anulacion.
-- -----------------------------------------------------------------------------
alter table public.ventas
  add column if not exists anulada_by uuid;

create index if not exists ventas_anulada_at_idx
  on public.ventas(anulada_at desc)
  where anulada_at is not null;

-- Kardex debe distinguir una devolución operativa producida por reversa.
alter table public.inventario_kardex
  drop constraint if exists inventario_kardex_tipo_check;

alter table public.inventario_kardex
  add constraint inventario_kardex_tipo_check check (
    tipo in (
      'snapshot_inicial',
      'reconciliacion',
      'traslado',
      'venta',
      'anulacion_venta'
    )
  );

-- -----------------------------------------------------------------------------
-- 2. Ultimo precio usado por producto.
-- Solo considera ventas que continúan confirmadas.
-- -----------------------------------------------------------------------------
drop view if exists public.ultimo_precio_venta;

create view public.ultimo_precio_venta
with (security_invoker = true)
as
select distinct on (vd.producto_id)
  vd.producto_id,
  vd.precio_unitario,
  v.id as venta_id,
  v.fecha
from public.venta_detalles vd
join public.ventas v on v.id = vd.venta_id
where v.estado = 'confirmada'
order by
  vd.producto_id,
  v.fecha desc,
  vd.id desc;

grant select on public.ultimo_precio_venta to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Resumen consultable para histórico de ventas.
-- Los agregados laterales evitan multiplicar detalles por medios de pago.
-- -----------------------------------------------------------------------------
drop view if exists public.ventas_historial_resumen;

create view public.ventas_historial_resumen
with (security_invoker = true)
as
select
  v.id,
  v.jornada_id,
  v.fecha,
  v.estado,
  v.total,
  v.observacion,
  v.anulada_at,
  v.anulada_motivo,
  v.promotor_id,
  trim(concat_ws(' ', pe.nombres, pe.apellidos)) as promotor_nombre,
  coalesce(d.unidades, 0)::bigint as unidades,
  coalesce(d.lineas, 0)::bigint as lineas,
  coalesce(d.categorias, array[]::text[]) as categorias,
  coalesce(d.tipos, array[]::text[]) as tipos,
  coalesce(pay.metodos_pago, array[]::text[]) as metodos_pago,
  lower(
    concat_ws(
      ' ',
      v.id::text,
      trim(concat_ws(' ', pe.nombres, pe.apellidos)),
      coalesce(d.busqueda, '')
    )
  ) as busqueda
from public.ventas v
join public.personas pe on pe.id = v.promotor_id
left join lateral (
  select
    sum(vd.cantidad)::bigint as unidades,
    count(*)::bigint as lineas,
    array_agg(distinct coalesce(p.categoria_principal, p.categoria))
      filter (
        where coalesce(p.categoria_principal, p.categoria) is not null
      ) as categorias,
    array_agg(distinct p.categoria_venta)
      filter (where p.categoria_venta is not null) as tipos,
    string_agg(
      distinct concat_ws(
        ' ',
        vd.sku,
        vd.descripcion,
        vd.serial,
        p.nombre,
        p.categoria_principal,
        p.categoria_venta,
        p.familia,
        p.variante
      ),
      ' '
    ) as busqueda
  from public.venta_detalles vd
  join public.productos p on p.id = vd.producto_id
  where vd.venta_id = v.id
) d on true
left join lateral (
  select
    array_agg(distinct vp.metodo)
      filter (where vp.metodo is not null) as metodos_pago
  from public.venta_pagos vp
  where vp.venta_id = v.id
) pay on true;

grant select on public.ventas_historial_resumen to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Reversa atomica.
-- No elimina datos: cambia estado, registra auditoria y genera entrada Kardex.
-- -----------------------------------------------------------------------------
create or replace function public.reverse_sale(
  p_venta_id uuid,
  p_motivo text
)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_estado text;
  v_fecha timestamptz;
  v_snapshot_id uuid;
  v_motivo text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  v_motivo := nullif(trim(coalesce(p_motivo, '')), '');

  if v_motivo is null or length(v_motivo) < 3 then
    raise exception 'REVERSAL_REASON_REQUIRED';
  end if;

  select estado, fecha
  into v_estado, v_fecha
  from public.ventas
  where id = p_venta_id
  for update;

  if not found then
    raise exception 'SALE_NOT_FOUND';
  end if;

  if v_estado = 'anulada' then
    raise exception 'SALE_ALREADY_REVERSED';
  end if;

  if v_estado <> 'confirmada' then
    raise exception 'SALE_NOT_REVERSIBLE';
  end if;

  select id
  into v_snapshot_id
  from public.inventory_snapshots
  where status = 'applied'
  order by applied_at desc nulls last, created_at desc
  limit 1;

  if v_snapshot_id is null then
    raise exception 'NO_APPLIED_SNAPSHOT';
  end if;

  update public.ventas
  set
    estado = 'anulada',
    anulada_at = now(),
    anulada_motivo = v_motivo,
    anulada_by = auth.uid()
  where id = p_venta_id;

  insert into public.inventario_kardex(
    producto_id,
    snapshot_id,
    venta_id,
    serial,
    direccion,
    tipo,
    clasificacion,
    cantidad,
    almacen_destino,
    ubicacion_destino,
    fecha,
    detalle
  )
  select
    vd.producto_id,
    coalesce(k.snapshot_id, v_snapshot_id),
    p_venta_id,
    vd.serial,
    'entrada',
    'anulacion_venta',
    'confirmado',
    vd.cantidad,
    coalesce(vd.almacen, 'KIOSKO MALL IQUITOS - KIO37'),
    coalesce(vd.ubicacion, 'Stock'),
    (timezone('America/Lima', now()))::date,
    'Reversa de venta: ' || v_motivo
  from public.venta_detalles vd
  left join lateral (
    select ik.snapshot_id
    from public.inventario_kardex ik
    where ik.venta_id = p_venta_id
      and ik.producto_id = vd.producto_id
      and ik.tipo = 'venta'
      and (
        (vd.serial is null and ik.serial is null)
        or upper(coalesce(ik.serial, '')) = upper(coalesce(vd.serial, ''))
      )
    order by ik.id desc
    limit 1
  ) k on true
  where vd.venta_id = p_venta_id;
end;
$function$;

revoke all on function public.reverse_sale(uuid, text) from public;
grant execute on function public.reverse_sale(uuid, text) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Stock operativo: snapshot + ventas posteriores + reversas posteriores.
-- Una reversa de una venta anterior al snapshot debe reincorporar stock.
-- Una venta posterior al snapshot anulada ya se restaura al dejar de contarse
-- como venta confirmada, por lo que no se suma dos veces.
-- -----------------------------------------------------------------------------
drop view if exists public.inventario_stock;

create view public.inventario_stock
with (security_invoker = true)
as
with current_snapshot as (
  select id, applied_at
  from public.inventory_snapshots
  where status = 'applied'
  order by applied_at desc nulls last, created_at desc
  limit 1
),
sold_serials as (
  select distinct upper(vd.serial) as serial
  from public.venta_detalles vd
  join public.ventas v on v.id = vd.venta_id
  join current_snapshot cs on true
  where vd.serial is not null
    and v.estado = 'confirmada'
    and v.fecha > cs.applied_at
),
sold_nonserial as (
  select
    vd.producto_id,
    lower(regexp_replace(trim(coalesce(vd.almacen, '')), '\s+', ' ', 'g'))
      as almacen_key,
    lower(regexp_replace(trim(coalesce(vd.ubicacion, '')), '\s+', ' ', 'g'))
      as ubicacion_key,
    sum(vd.cantidad)::bigint as cantidad
  from public.venta_detalles vd
  join public.ventas v on v.id = vd.venta_id
  join current_snapshot cs on true
  where vd.serial is null
    and v.estado = 'confirmada'
    and v.fecha > cs.applied_at
  group by
    vd.producto_id,
    lower(regexp_replace(trim(coalesce(vd.almacen, '')), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(coalesce(vd.ubicacion, '')), '\s+', ' ', 'g'))
),
returned_nonserial as (
  select
    vd.producto_id,
    lower(regexp_replace(trim(coalesce(vd.almacen, '')), '\s+', ' ', 'g'))
      as almacen_key,
    lower(regexp_replace(trim(coalesce(vd.ubicacion, '')), '\s+', ' ', 'g'))
      as ubicacion_key,
    max(coalesce(vd.almacen, 'KIOSKO MALL IQUITOS - KIO37')) as almacen,
    max(coalesce(vd.ubicacion, 'Stock')) as ubicacion,
    sum(vd.cantidad)::bigint as cantidad
  from public.venta_detalles vd
  join public.ventas v on v.id = vd.venta_id
  join current_snapshot cs on true
  where vd.serial is null
    and v.estado = 'anulada'
    and v.anulada_at > cs.applied_at
    and v.fecha <= cs.applied_at
  group by
    vd.producto_id,
    lower(regexp_replace(trim(coalesce(vd.almacen, '')), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(coalesce(vd.ubicacion, '')), '\s+', ' ', 'g'))
),
returned_serials as (
  select
    vd.producto_id,
    lower(regexp_replace(trim(coalesce(vd.almacen, '')), '\s+', ' ', 'g'))
      as almacen_key,
    lower(regexp_replace(trim(coalesce(vd.ubicacion, '')), '\s+', ' ', 'g'))
      as ubicacion_key,
    max(coalesce(vd.almacen, 'KIOSKO MALL IQUITOS - KIO37')) as almacen,
    max(coalesce(vd.ubicacion, 'Stock')) as ubicacion,
    count(distinct upper(vd.serial))::bigint as series_count,
    array_agg(distinct upper(vd.serial) order by upper(vd.serial)) as serials
  from public.venta_detalles vd
  join public.ventas v on v.id = vd.venta_id
  join current_snapshot cs on true
  where vd.serial is not null
    and v.estado = 'anulada'
    and v.anulada_at > cs.applied_at
    and v.fecha <= cs.applied_at
    and not exists (
      select 1
      from public.inventory_snapshot_items si
      where si.snapshot_id = cs.id
        and upper(si.serial) = upper(vd.serial)
    )
  group by
    vd.producto_id,
    lower(regexp_replace(trim(coalesce(vd.almacen, '')), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(coalesce(vd.ubicacion, '')), '\s+', ' ', 'g'))
),
location_base as (
  select
    i.producto_id,
    lower(regexp_replace(trim(i.almacen), '\s+', ' ', 'g')) as almacen_key,
    lower(regexp_replace(trim(i.ubicacion), '\s+', ' ', 'g')) as ubicacion_key,
    max(i.almacen) as almacen,
    max(i.ubicacion) as ubicacion,
    sum(i.cantidad_fisica)::bigint as cantidad_fisica,
    sum(
      case
        when i.serial is not null and ss.serial is not null then 0
        else i.cantidad_disponible
      end
    )::bigint as cantidad_disponible_base,
    sum(
      case
        when i.serial is not null and ss.serial is not null then 0
        else i.cantidad_operativa
      end
    )::bigint as stock_actual_base,
    count(i.serial) filter (
      where i.serial is not null and ss.serial is null
    )::bigint as series_count,
    coalesce(
      array_agg(distinct i.serial order by i.serial) filter (
        where i.serial is not null and ss.serial is null
      ),
      array[]::text[]
    ) as serials
  from public.inventory_snapshot_items i
  join current_snapshot cs on cs.id = i.snapshot_id
  left join sold_serials ss on ss.serial = upper(i.serial)
  group by
    i.producto_id,
    lower(regexp_replace(trim(i.almacen), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(i.ubicacion), '\s+', ' ', 'g'))
),
location_keys as (
  select producto_id, almacen_key, ubicacion_key, almacen, ubicacion
  from location_base
  union
  select producto_id, almacen_key, ubicacion_key, almacen, ubicacion
  from returned_nonserial
  union
  select producto_id, almacen_key, ubicacion_key, almacen, ubicacion
  from returned_serials
),
location_stock as (
  select
    lk.producto_id,
    lk.almacen_key,
    lk.ubicacion_key,
    coalesce(lb.almacen, rn.almacen, rs.almacen, lk.almacen) as almacen,
    coalesce(lb.ubicacion, rn.ubicacion, rs.ubicacion, lk.ubicacion) as ubicacion,
    coalesce(lb.cantidad_fisica, 0)::bigint as cantidad_fisica,
    greatest(
      coalesce(lb.cantidad_disponible_base, 0)
      - coalesce(sn.cantidad, 0)
      + coalesce(rn.cantidad, 0)
      + coalesce(rs.series_count, 0),
      0
    )::bigint as cantidad_disponible,
    greatest(
      coalesce(lb.stock_actual_base, 0)
      - coalesce(sn.cantidad, 0)
      + coalesce(rn.cantidad, 0)
      + coalesce(rs.series_count, 0),
      0
    )::bigint as stock_actual,
    (
      coalesce(lb.series_count, 0) + coalesce(rs.series_count, 0)
    )::bigint as series_count,
    array(
      select distinct value
      from unnest(
        coalesce(lb.serials, array[]::text[])
        || coalesce(rs.serials, array[]::text[])
      ) as value
      order by value
    ) as serials
  from location_keys lk
  left join location_base lb
    on lb.producto_id = lk.producto_id
   and lb.almacen_key = lk.almacen_key
   and lb.ubicacion_key = lk.ubicacion_key
  left join sold_nonserial sn
    on sn.producto_id = lk.producto_id
   and sn.almacen_key = lk.almacen_key
   and sn.ubicacion_key = lk.ubicacion_key
  left join returned_nonserial rn
    on rn.producto_id = lk.producto_id
   and rn.almacen_key = lk.almacen_key
   and rn.ubicacion_key = lk.ubicacion_key
  left join returned_serials rs
    on rs.producto_id = lk.producto_id
   and rs.almacen_key = lk.almacen_key
   and rs.ubicacion_key = lk.ubicacion_key
)
select
  (
    p.id::text || ':' ||
    md5(coalesce(ls.almacen, '') || '|' || coalesce(ls.ubicacion, ''))
  ) as row_key,
  p.id,
  p.sku,
  p.nombre,
  p.marca,
  coalesce(p.categoria_principal, p.categoria) as categoria,
  p.categoria_principal,
  p.categoria_venta,
  p.familia,
  p.variante,
  p.costo,
  p.precio,
  p.stock_minimo,
  p.is_active,
  ls.almacen,
  ls.ubicacion,
  coalesce(ls.cantidad_fisica, 0)::bigint as cantidad_fisica,
  coalesce(ls.cantidad_disponible, 0)::bigint as cantidad_disponible,
  coalesce(ls.stock_actual, 0)::bigint as stock_actual,
  coalesce(ls.series_count, 0)::bigint as series_count,
  coalesce(ls.serials, array[]::text[]) as serials,
  (
    coalesce(ls.stock_actual, 0) * p.costo
  )::numeric(14,2) as valor_stock
from public.productos p
join location_stock ls on ls.producto_id = p.id;

grant select on public.inventario_stock to authenticated;

insert into public.app_sql_versions(version, name)
values (9, 'ventas_historial_reversa_ultimo_precio');

commit;
