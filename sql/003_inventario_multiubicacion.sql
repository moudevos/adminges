-- AdminGes - INVENTARIO MULTIUBICACION
-- Requiere: 001_reset_nucleo.sql + 002_inventario_snapshots_kardex.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 2
  ) then
    raise exception 'Primero ejecuta 002_inventario_snapshots_kardex.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 3
  ) then
    raise exception 'La version 003 ya fue aplicada';
  end if;
end
$$;

-- Un SKU puede coexistir en Stock, Exhibición, Devoluciones y Tránsito.
-- La serie/IMEI continúa siendo única dentro de cada snapshot.
-- Para no serializados, la unidad de comparación es SKU + almacén + ubicación.

create index if not exists inventory_snapshot_items_location_idx
  on public.inventory_snapshot_items(snapshot_id, sku, almacen, ubicacion);

create or replace function public.apply_inventory_snapshot(p_snapshot_id uuid)
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_previous_snapshot_id uuid;
  v_snapshot_date date;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select snapshot_date
  into v_snapshot_date
  from public.inventory_snapshots
  where id = p_snapshot_id
    and status = 'validated'
  for update;

  if not found then
    raise exception 'SNAPSHOT_NOT_VALIDATED';
  end if;

  select id
  into v_previous_snapshot_id
  from public.inventory_snapshots
  where status = 'applied'
    and id <> p_snapshot_id
  order by applied_at desc nulls last, created_at desc
  limit 1
  for update;

  insert into public.productos (
    sku,
    nombre,
    categoria,
    descripcion_original,
    categoria_original,
    categoria_principal,
    categoria_venta,
    familia,
    variante,
    is_active
  )
  select distinct on (i.sku)
    i.sku,
    i.descripcion,
    i.categoria_principal,
    i.descripcion_original,
    i.categoria_original,
    i.categoria_principal,
    i.categoria_venta,
    i.familia,
    i.variante,
    true
  from public.inventory_snapshot_items i
  where i.snapshot_id = p_snapshot_id
  order by i.sku, i.row_number
  on conflict (sku) do update
  set
    nombre = excluded.nombre,
    categoria = excluded.categoria,
    descripcion_original = excluded.descripcion_original,
    categoria_original = excluded.categoria_original,
    categoria_principal = excluded.categoria_principal,
    categoria_venta = excluded.categoria_venta,
    familia = excluded.familia,
    variante = excluded.variante,
    is_active = true,
    updated_at = now();

  update public.inventory_snapshot_items i
  set producto_id = p.id
  from public.productos p
  where i.snapshot_id = p_snapshot_id
    and p.sku = i.sku;

  if exists (
    select 1
    from public.inventory_snapshot_items i
    join public.inventory_serial_registry r on r.serial = i.serial
    where i.snapshot_id = p_snapshot_id
      and i.serial is not null
      and r.sku <> i.sku
  ) then
    raise exception 'SERIAL_SKU_CONFLICT';
  end if;

  if v_previous_snapshot_id is null then
    insert into public.inventario_kardex (
      producto_id, snapshot_id, serial, direccion, tipo, clasificacion,
      cantidad, almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      i.producto_id,
      p_snapshot_id,
      i.serial,
      'entrada',
      'snapshot_inicial',
      'confirmado',
      1,
      i.almacen,
      i.ubicacion,
      v_snapshot_date,
      'Serie incorporada en snapshot inicial'
    from public.inventory_snapshot_items i
    where i.snapshot_id = p_snapshot_id
      and i.serial is not null;

    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad, almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      i.producto_id,
      p_snapshot_id,
      'entrada',
      'snapshot_inicial',
      'confirmado',
      sum(i.cantidad_fisica)::integer,
      i.almacen,
      i.ubicacion,
      v_snapshot_date,
      'Cantidad incorporada en snapshot inicial'
    from public.inventory_snapshot_items i
    where i.snapshot_id = p_snapshot_id
      and i.serial is null
    group by i.producto_id, i.sku, i.almacen, i.ubicacion
    having sum(i.cantidad_fisica) > 0;
  else
    -- Serializados: la misma serie puede cambiar de ubicación y eso es traslado.
    insert into public.inventario_kardex (
      producto_id, snapshot_id, serial, direccion, tipo, clasificacion,
      cantidad, almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      c.producto_id,
      p_snapshot_id,
      c.serial,
      'entrada',
      'reconciliacion',
      'confirmado',
      1,
      c.almacen,
      c.ubicacion,
      v_snapshot_date,
      'Serie nueva detectada por reconciliación'
    from public.inventory_snapshot_items c
    left join public.inventory_snapshot_items p
      on p.snapshot_id = v_previous_snapshot_id
     and p.serial = c.serial
    where c.snapshot_id = p_snapshot_id
      and c.serial is not null
      and p.id is null;

    insert into public.inventario_kardex (
      producto_id, snapshot_id, serial, direccion, tipo, clasificacion,
      cantidad,
      almacen_origen, ubicacion_origen,
      almacen_destino, ubicacion_destino,
      fecha, detalle
    )
    select
      c.producto_id,
      p_snapshot_id,
      c.serial,
      'traslado',
      'traslado',
      'confirmado',
      1,
      p.almacen,
      p.ubicacion,
      c.almacen,
      c.ubicacion,
      v_snapshot_date,
      'Cambio de ubicación detectado por reconciliación'
    from public.inventory_snapshot_items c
    join public.inventory_snapshot_items p
      on p.snapshot_id = v_previous_snapshot_id
     and p.serial = c.serial
    where c.snapshot_id = p_snapshot_id
      and c.serial is not null
      and (
        lower(trim(c.almacen)) <> lower(trim(p.almacen))
        or lower(trim(c.ubicacion)) <> lower(trim(p.ubicacion))
      );

    insert into public.inventario_kardex (
      producto_id, snapshot_id, serial, direccion, tipo, clasificacion,
      cantidad, almacen_origen, ubicacion_origen, fecha, detalle
    )
    select
      p.producto_id,
      p_snapshot_id,
      p.serial,
      'salida',
      'reconciliacion',
      'pendiente_venta',
      1,
      p.almacen,
      p.ubicacion,
      v_snapshot_date,
      'Serie ausente del nuevo snapshot; pendiente de validar contra ventas'
    from public.inventory_snapshot_items p
    left join public.inventory_snapshot_items c
      on c.snapshot_id = p_snapshot_id
     and c.serial = p.serial
    where p.snapshot_id = v_previous_snapshot_id
      and p.serial is not null
      and c.id is null;

    -- No serializados:
    -- 1) comparar por SKU + almacén + ubicación;
    -- 2) emparejar reducciones con incrementos del mismo SKU como traslados;
    -- 3) el saldo positivo es entrada y el saldo negativo queda pendiente de venta.
    with prev as (
      select
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')) as almacen_key,
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g')) as ubicacion_key,
        max(almacen) as almacen,
        max(ubicacion) as ubicacion,
        sum(cantidad_fisica)::integer as qty
      from public.inventory_snapshot_items
      where snapshot_id = v_previous_snapshot_id
        and serial is null
      group by
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g'))
    ),
    cand as (
      select
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')) as almacen_key,
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g')) as ubicacion_key,
        max(almacen) as almacen,
        max(ubicacion) as ubicacion,
        sum(cantidad_fisica)::integer as qty
      from public.inventory_snapshot_items
      where snapshot_id = p_snapshot_id
        and serial is null
      group by
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g'))
    ),
    loc_diff as (
      select
        coalesce(c.producto_id, p.producto_id) as producto_id,
        coalesce(c.sku, p.sku) as sku,
        p.almacen_key as prev_almacen_key,
        p.ubicacion_key as prev_ubicacion_key,
        p.almacen as prev_almacen,
        p.ubicacion as prev_ubicacion,
        c.almacen_key as cand_almacen_key,
        c.ubicacion_key as cand_ubicacion_key,
        c.almacen as cand_almacen,
        c.ubicacion as cand_ubicacion,
        coalesce(p.qty, 0) as prev_qty,
        coalesce(c.qty, 0) as cand_qty
      from prev p
      full join cand c
        on c.sku = p.sku
       and c.almacen_key = p.almacen_key
       and c.ubicacion_key = p.ubicacion_key
    ),
    sources as (
      select
        producto_id,
        sku,
        prev_almacen_key,
        prev_ubicacion_key,
        prev_almacen,
        prev_ubicacion,
        (prev_qty - cand_qty)::integer as qty_out
      from loc_diff
      where prev_qty > cand_qty
    ),
    destinations as (
      select
        producto_id,
        sku,
        cand_almacen_key,
        cand_ubicacion_key,
        cand_almacen,
        cand_ubicacion,
        (cand_qty - prev_qty)::integer as qty_in
      from loc_diff
      where cand_qty > prev_qty
    ),
    source_ranges as (
      select
        s.*,
        (
          sum(qty_out) over (
            partition by sku
            order by prev_almacen_key, prev_ubicacion_key
            rows between unbounded preceding and current row
          ) - qty_out
        )::integer as range_start,
        sum(qty_out) over (
          partition by sku
          order by prev_almacen_key, prev_ubicacion_key
          rows between unbounded preceding and current row
        )::integer as range_end
      from sources s
    ),
    destination_ranges as (
      select
        d.*,
        (
          sum(qty_in) over (
            partition by sku
            order by cand_almacen_key, cand_ubicacion_key
            rows between unbounded preceding and current row
          ) - qty_in
        )::integer as range_start,
        sum(qty_in) over (
          partition by sku
          order by cand_almacen_key, cand_ubicacion_key
          rows between unbounded preceding and current row
        )::integer as range_end
      from destinations d
    ),
    transfers as (
      select
        coalesce(d.producto_id, s.producto_id) as producto_id,
        s.sku,
        s.prev_almacen_key,
        s.prev_ubicacion_key,
        s.prev_almacen,
        s.prev_ubicacion,
        d.cand_almacen_key,
        d.cand_ubicacion_key,
        d.cand_almacen,
        d.cand_ubicacion,
        (
          least(s.range_end, d.range_end) -
          greatest(s.range_start, d.range_start)
        )::integer as qty
      from source_ranges s
      join destination_ranges d on d.sku = s.sku
      where
        least(s.range_end, d.range_end) >
        greatest(s.range_start, d.range_start)
    )
    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad,
      almacen_origen, ubicacion_origen,
      almacen_destino, ubicacion_destino,
      fecha, detalle
    )
    select
      t.producto_id,
      p_snapshot_id,
      'traslado',
      'traslado',
      'confirmado',
      t.qty,
      t.prev_almacen,
      t.prev_ubicacion,
      t.cand_almacen,
      t.cand_ubicacion,
      v_snapshot_date,
      'Traslado de producto no serializado detectado por reconciliación'
    from transfers t
    where t.qty > 0;

    with prev as (
      select
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')) as almacen_key,
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g')) as ubicacion_key,
        max(almacen) as almacen,
        max(ubicacion) as ubicacion,
        sum(cantidad_fisica)::integer as qty
      from public.inventory_snapshot_items
      where snapshot_id = v_previous_snapshot_id
        and serial is null
      group by
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g'))
    ),
    cand as (
      select
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')) as almacen_key,
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g')) as ubicacion_key,
        max(almacen) as almacen,
        max(ubicacion) as ubicacion,
        sum(cantidad_fisica)::integer as qty
      from public.inventory_snapshot_items
      where snapshot_id = p_snapshot_id
        and serial is null
      group by
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g'))
    ),
    loc_diff as (
      select
        coalesce(c.producto_id, p.producto_id) as producto_id,
        coalesce(c.sku, p.sku) as sku,
        p.almacen_key as prev_almacen_key,
        p.ubicacion_key as prev_ubicacion_key,
        p.almacen as prev_almacen,
        p.ubicacion as prev_ubicacion,
        c.almacen_key as cand_almacen_key,
        c.ubicacion_key as cand_ubicacion_key,
        c.almacen as cand_almacen,
        c.ubicacion as cand_ubicacion,
        coalesce(p.qty, 0) as prev_qty,
        coalesce(c.qty, 0) as cand_qty
      from prev p
      full join cand c
        on c.sku = p.sku
       and c.almacen_key = p.almacen_key
       and c.ubicacion_key = p.ubicacion_key
    ),
    sources as (
      select
        producto_id,
        sku,
        prev_almacen_key,
        prev_ubicacion_key,
        prev_almacen,
        prev_ubicacion,
        (prev_qty - cand_qty)::integer as qty_out
      from loc_diff
      where prev_qty > cand_qty
    ),
    destinations as (
      select
        producto_id,
        sku,
        cand_almacen_key,
        cand_ubicacion_key,
        cand_almacen,
        cand_ubicacion,
        (cand_qty - prev_qty)::integer as qty_in
      from loc_diff
      where cand_qty > prev_qty
    ),
    source_ranges as (
      select
        s.*,
        (
          sum(qty_out) over (
            partition by sku
            order by prev_almacen_key, prev_ubicacion_key
            rows between unbounded preceding and current row
          ) - qty_out
        )::integer as range_start,
        sum(qty_out) over (
          partition by sku
          order by prev_almacen_key, prev_ubicacion_key
          rows between unbounded preceding and current row
        )::integer as range_end
      from sources s
    ),
    destination_ranges as (
      select
        d.*,
        (
          sum(qty_in) over (
            partition by sku
            order by cand_almacen_key, cand_ubicacion_key
            rows between unbounded preceding and current row
          ) - qty_in
        )::integer as range_start,
        sum(qty_in) over (
          partition by sku
          order by cand_almacen_key, cand_ubicacion_key
          rows between unbounded preceding and current row
        )::integer as range_end
      from destinations d
    ),
    transfers as (
      select
        s.sku,
        s.prev_almacen_key,
        s.prev_ubicacion_key,
        d.cand_almacen_key,
        d.cand_ubicacion_key,
        (
          least(s.range_end, d.range_end) -
          greatest(s.range_start, d.range_start)
        )::integer as qty
      from source_ranges s
      join destination_ranges d on d.sku = s.sku
      where
        least(s.range_end, d.range_end) >
        greatest(s.range_start, d.range_start)
    ),
    transferred_in as (
      select
        sku,
        cand_almacen_key,
        cand_ubicacion_key,
        sum(qty)::integer as qty
      from transfers
      group by sku, cand_almacen_key, cand_ubicacion_key
    )
    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad, almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      d.producto_id,
      p_snapshot_id,
      'entrada',
      'reconciliacion',
      'confirmado',
      d.qty_in - coalesce(t.qty, 0),
      d.cand_almacen,
      d.cand_ubicacion,
      v_snapshot_date,
      'Incremento neto detectado por reconciliación'
    from destinations d
    left join transferred_in t
      on t.sku = d.sku
     and t.cand_almacen_key = d.cand_almacen_key
     and t.cand_ubicacion_key = d.cand_ubicacion_key
    where d.qty_in - coalesce(t.qty, 0) > 0;

    with prev as (
      select
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')) as almacen_key,
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g')) as ubicacion_key,
        max(almacen) as almacen,
        max(ubicacion) as ubicacion,
        sum(cantidad_fisica)::integer as qty
      from public.inventory_snapshot_items
      where snapshot_id = v_previous_snapshot_id
        and serial is null
      group by
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g'))
    ),
    cand as (
      select
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')) as almacen_key,
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g')) as ubicacion_key,
        max(almacen) as almacen,
        max(ubicacion) as ubicacion,
        sum(cantidad_fisica)::integer as qty
      from public.inventory_snapshot_items
      where snapshot_id = p_snapshot_id
        and serial is null
      group by
        producto_id,
        sku,
        lower(regexp_replace(trim(almacen), '\s+', ' ', 'g')),
        lower(regexp_replace(trim(ubicacion), '\s+', ' ', 'g'))
    ),
    loc_diff as (
      select
        coalesce(c.producto_id, p.producto_id) as producto_id,
        coalesce(c.sku, p.sku) as sku,
        p.almacen_key as prev_almacen_key,
        p.ubicacion_key as prev_ubicacion_key,
        p.almacen as prev_almacen,
        p.ubicacion as prev_ubicacion,
        c.almacen_key as cand_almacen_key,
        c.ubicacion_key as cand_ubicacion_key,
        coalesce(p.qty, 0) as prev_qty,
        coalesce(c.qty, 0) as cand_qty
      from prev p
      full join cand c
        on c.sku = p.sku
       and c.almacen_key = p.almacen_key
       and c.ubicacion_key = p.ubicacion_key
    ),
    sources as (
      select
        producto_id,
        sku,
        prev_almacen_key,
        prev_ubicacion_key,
        prev_almacen,
        prev_ubicacion,
        (prev_qty - cand_qty)::integer as qty_out
      from loc_diff
      where prev_qty > cand_qty
    ),
    destinations as (
      select
        sku,
        cand_almacen_key,
        cand_ubicacion_key,
        (cand_qty - prev_qty)::integer as qty_in
      from loc_diff
      where cand_qty > prev_qty
    ),
    source_ranges as (
      select
        s.*,
        (
          sum(qty_out) over (
            partition by sku
            order by prev_almacen_key, prev_ubicacion_key
            rows between unbounded preceding and current row
          ) - qty_out
        )::integer as range_start,
        sum(qty_out) over (
          partition by sku
          order by prev_almacen_key, prev_ubicacion_key
          rows between unbounded preceding and current row
        )::integer as range_end
      from sources s
    ),
    destination_ranges as (
      select
        d.*,
        (
          sum(qty_in) over (
            partition by sku
            order by cand_almacen_key, cand_ubicacion_key
            rows between unbounded preceding and current row
          ) - qty_in
        )::integer as range_start,
        sum(qty_in) over (
          partition by sku
          order by cand_almacen_key, cand_ubicacion_key
          rows between unbounded preceding and current row
        )::integer as range_end
      from destinations d
    ),
    transfers as (
      select
        s.sku,
        s.prev_almacen_key,
        s.prev_ubicacion_key,
        (
          least(s.range_end, d.range_end) -
          greatest(s.range_start, d.range_start)
        )::integer as qty
      from source_ranges s
      join destination_ranges d on d.sku = s.sku
      where
        least(s.range_end, d.range_end) >
        greatest(s.range_start, d.range_start)
    ),
    transferred_out as (
      select
        sku,
        prev_almacen_key,
        prev_ubicacion_key,
        sum(qty)::integer as qty
      from transfers
      group by sku, prev_almacen_key, prev_ubicacion_key
    )
    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad, almacen_origen, ubicacion_origen, fecha, detalle
    )
    select
      s.producto_id,
      p_snapshot_id,
      'salida',
      'reconciliacion',
      'pendiente_venta',
      s.qty_out - coalesce(t.qty, 0),
      s.prev_almacen,
      s.prev_ubicacion,
      v_snapshot_date,
      'Reducción neta detectada; pendiente de validar contra ventas'
    from sources s
    left join transferred_out t
      on t.sku = s.sku
     and t.prev_almacen_key = s.prev_almacen_key
     and t.prev_ubicacion_key = s.prev_ubicacion_key
    where s.qty_out - coalesce(t.qty, 0) > 0;
  end if;

  insert into public.inventory_serial_registry (
    serial,
    sku,
    producto_id,
    first_snapshot_id,
    last_snapshot_id,
    first_seen_at,
    last_seen_at
  )
  select distinct
    i.serial,
    i.sku,
    i.producto_id,
    p_snapshot_id,
    p_snapshot_id,
    now(),
    now()
  from public.inventory_snapshot_items i
  where i.snapshot_id = p_snapshot_id
    and i.serial is not null
  on conflict (serial) do update
  set
    last_snapshot_id = excluded.last_snapshot_id,
    last_seen_at = now();

  if v_previous_snapshot_id is not null then
    update public.inventory_snapshots
    set status = 'superseded'
    where id = v_previous_snapshot_id;
  end if;

  update public.inventory_snapshots
  set
    status = 'applied',
    applied_at = now()
  where id = p_snapshot_id;
end;
$function$;

revoke all on function public.apply_inventory_snapshot(uuid) from public;
grant execute on function public.apply_inventory_snapshot(uuid) to authenticated;

-- Una fila por SKU + almacén + ubicación. Así Stock, Exhibición y Tránsito
-- permanecen visibles simultáneamente.
drop view if exists public.inventario_stock;

create view public.inventario_stock
with (security_invoker = true)
as
with current_snapshot as (
  select id
  from public.inventory_snapshots
  where status = 'applied'
  order by applied_at desc
  limit 1
),
location_stock as (
  select
    i.producto_id,
    max(i.almacen) as almacen,
    max(i.ubicacion) as ubicacion,
    sum(i.cantidad_fisica)::bigint as cantidad_fisica,
    sum(i.cantidad_disponible)::bigint as cantidad_disponible,
    sum(i.cantidad_operativa)::bigint as stock_actual,
    count(i.serial) filter (where i.serial is not null)::bigint as series_count
  from public.inventory_snapshot_items i
  join current_snapshot cs on cs.id = i.snapshot_id
  group by
    i.producto_id,
    lower(regexp_replace(trim(i.almacen), '\\s+', ' ', 'g')),
    lower(regexp_replace(trim(i.ubicacion), '\\s+', ' ', 'g'))
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
  (
    coalesce(ls.stock_actual, 0) * p.costo
  )::numeric(14,2) as valor_stock
from public.productos p
join location_stock ls on ls.producto_id = p.id;

grant select on public.inventario_stock to authenticated;

insert into public.app_sql_versions(version, name)
values (3, 'inventario_multiubicacion');

commit;
