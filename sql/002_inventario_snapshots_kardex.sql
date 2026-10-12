-- AdminGes - INVENTARIO POR SNAPSHOTS + KARDEX
-- Requiere: 001_reset_nucleo.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 1
  ) then
    raise exception 'Primero ejecuta 001_reset_nucleo.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 2
  ) then
    raise exception 'La version 002 ya fue aplicada';
  end if;
end
$$;

alter table public.productos
  add column if not exists descripcion_original text,
  add column if not exists categoria_original text,
  add column if not exists categoria_principal text,
  add column if not exists categoria_venta text,
  add column if not exists familia text,
  add column if not exists variante text;

create index if not exists productos_categoria_principal_idx
  on public.productos(categoria_principal);
create index if not exists productos_categoria_venta_idx
  on public.productos(categoria_venta);

create table public.inventory_snapshots (
  id uuid primary key default gen_random_uuid(),
  snapshot_date date not null,
  file_name text not null,
  storage_path text not null,
  mime_type text,
  file_size bigint not null default 0 check (file_size >= 0),
  status text not null check (
    status in ('uploaded', 'validated', 'applied', 'error', 'superseded')
  ),
  sku_count integer not null default 0 check (sku_count >= 0),
  unit_count integer not null default 0 check (unit_count >= 0),
  series_count integer not null default 0 check (series_count >= 0),
  new_sku_count integer not null default 0 check (new_sku_count >= 0),
  exhausted_sku_count integer not null default 0 check (exhausted_sku_count >= 0),
  previous_sku_count integer not null default 0 check (previous_sku_count >= 0),
  previous_unit_count integer not null default 0 check (previous_unit_count >= 0),
  sku_difference integer not null default 0,
  unit_difference integer not null default 0,
  location_summary jsonb not null default '[]'::jsonb,
  validation_errors jsonb not null default '[]'::jsonb,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  applied_at timestamptz
);

create index inventory_snapshots_date_idx
  on public.inventory_snapshots(snapshot_date desc, created_at desc);
create index inventory_snapshots_status_idx
  on public.inventory_snapshots(status, created_at desc);
create unique index inventory_snapshots_single_applied_idx
  on public.inventory_snapshots ((status))
  where status = 'applied';

create table public.inventory_snapshot_items (
  id bigint generated always as identity primary key,
  snapshot_id uuid not null
    references public.inventory_snapshots(id) on delete cascade,
  row_number integer not null check (row_number > 0),
  producto_id uuid references public.productos(id) on delete restrict,
  sku text not null,
  serial text,
  descripcion_original text,
  descripcion text not null,
  cantidad_fisica integer not null check (cantidad_fisica >= 0),
  cantidad_disponible integer not null check (cantidad_disponible >= 0),
  cantidad_operativa integer not null check (cantidad_operativa >= 0),
  almacen text not null,
  ubicacion text not null,
  categoria_original text,
  categoria_principal text,
  categoria_venta text,
  familia text,
  variante text,
  created_at timestamptz not null default now(),
  unique (snapshot_id, row_number)
);

create unique index inventory_snapshot_items_serial_unique_idx
  on public.inventory_snapshot_items(snapshot_id, serial)
  where serial is not null;

create index inventory_snapshot_items_snapshot_sku_idx
  on public.inventory_snapshot_items(snapshot_id, sku);
create index inventory_snapshot_items_product_idx
  on public.inventory_snapshot_items(producto_id);
create index inventory_snapshot_items_serial_idx
  on public.inventory_snapshot_items(serial)
  where serial is not null;

create table public.inventory_serial_registry (
  serial text primary key,
  sku text not null,
  producto_id uuid not null references public.productos(id) on delete restrict,
  first_snapshot_id uuid not null
    references public.inventory_snapshots(id) on delete restrict,
  last_snapshot_id uuid not null
    references public.inventory_snapshots(id) on delete restrict,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index inventory_serial_registry_product_idx
  on public.inventory_serial_registry(producto_id);

-- Snapshot = estado canónico. Kardex = explicación histórica del cambio.
create table public.inventario_kardex (
  id bigint generated always as identity primary key,
  producto_id uuid not null references public.productos(id) on delete restrict,
  snapshot_id uuid not null
    references public.inventory_snapshots(id) on delete restrict,
  venta_id uuid references public.ventas(id) on delete set null,
  serial text,
  direccion text not null check (
    direccion in ('entrada', 'salida', 'traslado')
  ),
  tipo text not null check (
    tipo in ('snapshot_inicial', 'reconciliacion', 'traslado', 'venta')
  ),
  clasificacion text not null default 'confirmado' check (
    clasificacion in ('confirmado', 'pendiente_venta')
  ),
  cantidad integer not null check (cantidad > 0),
  almacen_origen text,
  ubicacion_origen text,
  almacen_destino text,
  ubicacion_destino text,
  fecha date not null,
  detalle text,
  created_at timestamptz not null default now()
);

create index inventario_kardex_producto_fecha_idx
  on public.inventario_kardex(producto_id, fecha desc, id desc);
create index inventario_kardex_serial_fecha_idx
  on public.inventario_kardex(serial, fecha desc)
  where serial is not null;
create index inventario_kardex_snapshot_idx
  on public.inventario_kardex(snapshot_id);
create index inventario_kardex_tipo_fecha_idx
  on public.inventario_kardex(tipo, fecha desc);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'inventory-snapshots',
  'inventory-snapshots',
  false,
  10485760,
  array[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/csv',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.inventory_snapshots enable row level security;
alter table public.inventory_snapshot_items enable row level security;
alter table public.inventory_serial_registry enable row level security;
alter table public.inventario_kardex enable row level security;

create policy inventory_snapshots_authenticated_all
on public.inventory_snapshots for all to authenticated
using (true) with check (true);

create policy inventory_snapshot_items_authenticated_all
on public.inventory_snapshot_items for all to authenticated
using (true) with check (true);

create policy inventory_serial_registry_authenticated_all
on public.inventory_serial_registry for all to authenticated
using (true) with check (true);

create policy inventario_kardex_authenticated_select
on public.inventario_kardex for select to authenticated
using (true);

create policy inventario_kardex_authenticated_insert
on public.inventario_kardex for insert to authenticated
with check (true);

grant select, insert, update, delete
on public.inventory_snapshots to authenticated;
grant select, insert, update, delete
on public.inventory_snapshot_items to authenticated;
grant select, insert, update, delete
on public.inventory_serial_registry to authenticated;
grant select, insert
on public.inventario_kardex to authenticated;
grant usage, select on all sequences in schema public to authenticated;

drop policy if exists inventory_snapshots_storage_select on storage.objects;
drop policy if exists inventory_snapshots_storage_insert on storage.objects;
drop policy if exists inventory_snapshots_storage_update on storage.objects;
drop policy if exists inventory_snapshots_storage_delete on storage.objects;

create policy inventory_snapshots_storage_select
on storage.objects for select to authenticated
using (bucket_id = 'inventory-snapshots');

create policy inventory_snapshots_storage_insert
on storage.objects for insert to authenticated
with check (bucket_id = 'inventory-snapshots');

create policy inventory_snapshots_storage_update
on storage.objects for update to authenticated
using (bucket_id = 'inventory-snapshots')
with check (bucket_id = 'inventory-snapshots');

create policy inventory_snapshots_storage_delete
on storage.objects for delete to authenticated
using (bucket_id = 'inventory-snapshots');

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
      i.producto_id, p_snapshot_id, i.serial, 'entrada', 'snapshot_inicial',
      'confirmado', 1, i.almacen, i.ubicacion, v_snapshot_date,
      'Serie incorporada en snapshot inicial'
    from public.inventory_snapshot_items i
    where i.snapshot_id = p_snapshot_id
      and i.serial is not null;

    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad, almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      i.producto_id, p_snapshot_id, 'entrada', 'snapshot_inicial',
      'confirmado', sum(i.cantidad_fisica)::integer,
      max(i.almacen), max(i.ubicacion), v_snapshot_date,
      'Cantidad incorporada en snapshot inicial'
    from public.inventory_snapshot_items i
    where i.snapshot_id = p_snapshot_id
      and i.serial is null
    group by i.producto_id, i.sku
    having sum(i.cantidad_fisica) > 0;
  else
    insert into public.inventario_kardex (
      producto_id, snapshot_id, serial, direccion, tipo, clasificacion,
      cantidad, almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      c.producto_id, p_snapshot_id, c.serial, 'entrada', 'reconciliacion',
      'confirmado', 1, c.almacen, c.ubicacion, v_snapshot_date,
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
      cantidad, almacen_origen, ubicacion_origen,
      almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      c.producto_id, p_snapshot_id, c.serial, 'traslado', 'traslado',
      'confirmado', 1, p.almacen, p.ubicacion, c.almacen, c.ubicacion,
      v_snapshot_date, 'Cambio de ubicación detectado por reconciliación'
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
      p.producto_id, p_snapshot_id, p.serial, 'salida', 'reconciliacion',
      'pendiente_venta', 1, p.almacen, p.ubicacion, v_snapshot_date,
      'Serie ausente del nuevo snapshot; pendiente de validar contra ventas'
    from public.inventory_snapshot_items p
    left join public.inventory_snapshot_items c
      on c.snapshot_id = p_snapshot_id
     and c.serial = p.serial
    where p.snapshot_id = v_previous_snapshot_id
      and p.serial is not null
      and c.id is null;

    with prev as (
      select
        producto_id, sku, max(almacen) almacen, max(ubicacion) ubicacion,
        sum(cantidad_fisica)::integer qty
      from public.inventory_snapshot_items
      where snapshot_id = v_previous_snapshot_id and serial is null
      group by producto_id, sku
    ),
    cand as (
      select
        producto_id, sku, max(almacen) almacen, max(ubicacion) ubicacion,
        sum(cantidad_fisica)::integer qty
      from public.inventory_snapshot_items
      where snapshot_id = p_snapshot_id and serial is null
      group by producto_id, sku
    ),
    diff as (
      select
        coalesce(c.producto_id, p.producto_id) producto_id,
        p.almacen prev_almacen,
        p.ubicacion prev_ubicacion,
        c.almacen cand_almacen,
        c.ubicacion cand_ubicacion,
        coalesce(p.qty, 0) prev_qty,
        coalesce(c.qty, 0) cand_qty
      from prev p
      full join cand c on c.sku = p.sku
    )
    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad, almacen_origen, ubicacion_origen,
      almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      d.producto_id, p_snapshot_id, 'traslado', 'traslado', 'confirmado',
      least(d.prev_qty, d.cand_qty), d.prev_almacen, d.prev_ubicacion,
      d.cand_almacen, d.cand_ubicacion, v_snapshot_date,
      'Traslado de producto no serializado detectado por reconciliación'
    from diff d
    where d.prev_qty > 0
      and d.cand_qty > 0
      and (
        lower(trim(d.prev_almacen)) <> lower(trim(d.cand_almacen))
        or lower(trim(d.prev_ubicacion)) <> lower(trim(d.cand_ubicacion))
      )
      and least(d.prev_qty, d.cand_qty) > 0;

    with prev as (
      select
        producto_id, sku, max(almacen) almacen, max(ubicacion) ubicacion,
        sum(cantidad_fisica)::integer qty
      from public.inventory_snapshot_items
      where snapshot_id = v_previous_snapshot_id and serial is null
      group by producto_id, sku
    ),
    cand as (
      select
        producto_id, sku, max(almacen) almacen, max(ubicacion) ubicacion,
        sum(cantidad_fisica)::integer qty
      from public.inventory_snapshot_items
      where snapshot_id = p_snapshot_id and serial is null
      group by producto_id, sku
    ),
    diff as (
      select
        coalesce(c.producto_id, p.producto_id) producto_id,
        c.almacen cand_almacen,
        c.ubicacion cand_ubicacion,
        coalesce(p.qty, 0) prev_qty,
        coalesce(c.qty, 0) cand_qty
      from prev p
      full join cand c on c.sku = p.sku
    )
    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad, almacen_destino, ubicacion_destino, fecha, detalle
    )
    select
      d.producto_id, p_snapshot_id, 'entrada', 'reconciliacion',
      'confirmado', d.cand_qty - d.prev_qty,
      d.cand_almacen, d.cand_ubicacion, v_snapshot_date,
      'Incremento neto detectado por reconciliación'
    from diff d
    where d.cand_qty > d.prev_qty;

    with prev as (
      select
        producto_id, sku, max(almacen) almacen, max(ubicacion) ubicacion,
        sum(cantidad_fisica)::integer qty
      from public.inventory_snapshot_items
      where snapshot_id = v_previous_snapshot_id and serial is null
      group by producto_id, sku
    ),
    cand as (
      select
        producto_id, sku, max(almacen) almacen, max(ubicacion) ubicacion,
        sum(cantidad_fisica)::integer qty
      from public.inventory_snapshot_items
      where snapshot_id = p_snapshot_id and serial is null
      group by producto_id, sku
    ),
    diff as (
      select
        coalesce(c.producto_id, p.producto_id) producto_id,
        p.almacen prev_almacen,
        p.ubicacion prev_ubicacion,
        coalesce(p.qty, 0) prev_qty,
        coalesce(c.qty, 0) cand_qty
      from prev p
      full join cand c on c.sku = p.sku
    )
    insert into public.inventario_kardex (
      producto_id, snapshot_id, direccion, tipo, clasificacion,
      cantidad, almacen_origen, ubicacion_origen, fecha, detalle
    )
    select
      d.producto_id, p_snapshot_id, 'salida', 'reconciliacion',
      'pendiente_venta', d.prev_qty - d.cand_qty,
      d.prev_almacen, d.prev_ubicacion, v_snapshot_date,
      'Reducción neta detectada; pendiente de validar contra ventas'
    from diff d
    where d.prev_qty > d.cand_qty;
  end if;

  insert into public.inventory_serial_registry (
    serial, sku, producto_id, first_snapshot_id, last_snapshot_id,
    first_seen_at, last_seen_at
  )
  select distinct
    i.serial, i.sku, i.producto_id, p_snapshot_id, p_snapshot_id, now(), now()
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
  set status = 'applied', applied_at = now()
  where id = p_snapshot_id;
end;
$function$;

revoke all on function public.apply_inventory_snapshot(uuid) from public;
grant execute on function public.apply_inventory_snapshot(uuid) to authenticated;

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
)
select
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
  max(i.almacen) as almacen,
  max(i.ubicacion) as ubicacion,
  coalesce(sum(i.cantidad_fisica), 0)::bigint as cantidad_fisica,
  coalesce(sum(i.cantidad_disponible), 0)::bigint as cantidad_disponible,
  coalesce(sum(i.cantidad_operativa), 0)::bigint as stock_actual,
  (
    coalesce(sum(i.cantidad_operativa), 0) * p.costo
  )::numeric(14,2) as valor_stock
from public.productos p
left join current_snapshot cs on true
left join public.inventory_snapshot_items i
  on i.snapshot_id = cs.id
 and i.producto_id = p.id
group by
  p.id, p.sku, p.nombre, p.marca, p.categoria,
  p.categoria_principal, p.categoria_venta, p.familia, p.variante,
  p.costo, p.precio, p.stock_minimo, p.is_active;

grant select on public.inventario_stock to authenticated;

insert into public.app_sql_versions(version, name)
values (2, 'inventario_snapshots_kardex');

commit;
