-- AdminGes - STOCK FILTERABLE CON SERIES
-- Requiere: 003_inventario_multiubicacion.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 3
  ) then
    raise exception 'Primero ejecuta 003_inventario_multiubicacion.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 4
  ) then
    raise exception 'La version 004 ya fue aplicada';
  end if;
end
$$;

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
    count(i.serial) filter (where i.serial is not null)::bigint as series_count,
    coalesce(
      array_agg(distinct i.serial order by i.serial)
        filter (where i.serial is not null),
      array[]::text[]
    ) as serials
  from public.inventory_snapshot_items i
  join current_snapshot cs on cs.id = i.snapshot_id
  group by
    i.producto_id,
    lower(regexp_replace(trim(i.almacen), '\s+', ' ', 'g')),
    lower(regexp_replace(trim(i.ubicacion), '\s+', ' ', 'g'))
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
values (4, 'inventario_stock_filtros_series');

commit;
