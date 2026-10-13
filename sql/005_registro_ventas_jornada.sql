-- AdminGes - JORNADA Y REGISTRO DE VENTAS
-- Requiere: 004_inventario_stock_filtros_series.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 4
  ) then
    raise exception 'Primero ejecuta 004_inventario_stock_filtros_series.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 5
  ) then
    raise exception 'La version 005 ya fue aplicada';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Jornada diaria y equipo en turno
-- -----------------------------------------------------------------------------
create table public.jornadas_venta (
  id uuid primary key default gen_random_uuid(),
  fecha date not null unique,
  estado text not null default 'abierta'
    check (estado in ('abierta', 'cerrada')),
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create unique index jornadas_venta_single_open_idx
  on public.jornadas_venta ((estado))
  where estado = 'abierta';

create table public.jornada_personal (
  jornada_id uuid not null
    references public.jornadas_venta(id) on delete cascade,
  persona_id uuid not null
    references public.personas(id) on delete restrict,
  en_turno boolean not null default false,
  inicio_turno timestamptz,
  fin_turno timestamptz,
  updated_at timestamptz not null default now(),
  primary key (jornada_id, persona_id)
);

create index jornada_personal_persona_idx
  on public.jornada_personal(persona_id, jornada_id);

-- -----------------------------------------------------------------------------
-- 2. Extender ventas existentes
-- -----------------------------------------------------------------------------
alter table public.ventas
  add column if not exists jornada_id uuid
    references public.jornadas_venta(id) on delete restrict,
  add column if not exists estado text not null default 'confirmada'
    check (estado in ('confirmada', 'anulada')),
  add column if not exists anulada_at timestamptz,
  add column if not exists anulada_motivo text,
  add column if not exists created_by uuid default auth.uid();

create index if not exists ventas_jornada_fecha_idx
  on public.ventas(jornada_id, fecha desc);
create index if not exists ventas_estado_fecha_idx
  on public.ventas(estado, fecha desc);

alter table public.venta_detalles
  add column if not exists sku text,
  add column if not exists descripcion text,
  add column if not exists serial text,
  add column if not exists almacen text,
  add column if not exists ubicacion text;

create index if not exists venta_detalles_serial_idx
  on public.venta_detalles(serial)
  where serial is not null;

create table public.venta_pagos (
  id bigint generated always as identity primary key,
  venta_id uuid not null references public.ventas(id) on delete cascade,
  metodo text not null check (
    metodo in ('efectivo', 'tarjeta', 'yape', 'plin', 'transferencia')
  ),
  monto numeric(12,2) not null check (monto > 0),
  referencia text,
  created_at timestamptz not null default now()
);

create index venta_pagos_venta_idx on public.venta_pagos(venta_id);
create index venta_pagos_metodo_idx on public.venta_pagos(metodo, created_at desc);

-- -----------------------------------------------------------------------------
-- 3. Seguridad / Data API
-- -----------------------------------------------------------------------------
alter table public.jornadas_venta enable row level security;
alter table public.jornada_personal enable row level security;
alter table public.venta_pagos enable row level security;

create policy jornadas_venta_authenticated_all
on public.jornadas_venta for all to authenticated
using (true) with check (true);

create policy jornada_personal_authenticated_all
on public.jornada_personal for all to authenticated
using (true) with check (true);

create policy venta_pagos_authenticated_all
on public.venta_pagos for all to authenticated
using (true) with check (true);

grant select, insert, update, delete
on public.jornadas_venta to authenticated;
grant select, insert, update, delete
on public.jornada_personal to authenticated;
grant select, insert, update, delete
on public.venta_pagos to authenticated;

grant select, insert, update, delete on public.ventas to authenticated;
grant select, insert, update, delete on public.venta_detalles to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Abrir jornada
-- -----------------------------------------------------------------------------
create or replace function public.open_sales_day(p_fecha date)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_jornada_id uuid;
  v_existing_state text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_fecha <> (timezone('America/Lima', now()))::date then
    raise exception 'ONLY_CURRENT_DAY';
  end if;

  select id, estado
  into v_jornada_id, v_existing_state
  from public.jornadas_venta
  where fecha = p_fecha
  limit 1;

  if v_jornada_id is not null then
    if v_existing_state = 'cerrada' then
      raise exception 'DAY_ALREADY_CLOSED';
    end if;

    return v_jornada_id;
  end if;

  if exists (
    select 1
    from public.jornadas_venta
    where estado = 'abierta'
  ) then
    raise exception 'ANOTHER_DAY_OPEN';
  end if;

  insert into public.jornadas_venta(fecha, estado)
  values (p_fecha, 'abierta')
  returning id into v_jornada_id;

  insert into public.jornada_personal(jornada_id, persona_id, en_turno)
  select v_jornada_id, p.id, false
  from public.personas p
  where p.is_active = true
  on conflict (jornada_id, persona_id) do nothing;

  return v_jornada_id;
end;
$function$;

revoke all on function public.open_sales_day(date) from public;
grant execute on function public.open_sales_day(date) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Turnos simples
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
  ) then
    raise exception 'DAY_NOT_OPEN';
  end if;

  if not exists (
    select 1
    from public.personas
    where id = p_persona_id
      and is_active = true
  ) then
    raise exception 'PERSON_NOT_ACTIVE';
  end if;

  insert into public.jornada_personal(
    jornada_id,
    persona_id,
    en_turno,
    inicio_turno,
    fin_turno,
    updated_at
  )
  values (
    p_jornada_id,
    p_persona_id,
    p_en_turno,
    case when p_en_turno then now() else null end,
    case when p_en_turno then null else now() end,
    now()
  )
  on conflict (jornada_id, persona_id) do update
  set
    en_turno = excluded.en_turno,
    inicio_turno = case
      when excluded.en_turno and public.jornada_personal.inicio_turno is null
        then now()
      else public.jornada_personal.inicio_turno
    end,
    fin_turno = case
      when excluded.en_turno then null
      else now()
    end,
    updated_at = now();
end;
$function$;

revoke all on function public.set_sales_shift(uuid, uuid, boolean) from public;
grant execute on function public.set_sales_shift(uuid, uuid, boolean)
to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Cerrar jornada
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
    and estado = 'abierta';

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

-- -----------------------------------------------------------------------------
-- 7. Registrar venta de forma atómica
-- p_items:
-- [{ producto_id, serial?, cantidad, precio_unitario }]
--
-- p_pagos:
-- [{ metodo, monto, referencia? }]
-- -----------------------------------------------------------------------------
create or replace function public.register_sale(
  p_jornada_id uuid,
  p_promotor_id uuid,
  p_items jsonb,
  p_pagos jsonb,
  p_observacion text default null
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_jornada_fecha date;
  v_venta_id uuid;
  v_snapshot_id uuid;
  v_snapshot_applied_at timestamptz;
  v_item jsonb;
  v_pago jsonb;
  v_producto_id uuid;
  v_producto_sku text;
  v_producto_nombre text;
  v_serial text;
  v_cantidad integer;
  v_precio numeric(12,2);
  v_total numeric(12,2) := 0;
  v_total_pagos numeric(12,2) := 0;
  v_snapshot_stock integer;
  v_sold_since_snapshot integer;
  v_available integer;
  v_almacen text;
  v_ubicacion text;
  v_seen_serials text[] := array[]::text[];
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'SALE_ITEMS_REQUIRED';
  end if;

  if jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) = 0 then
    raise exception 'SALE_PAYMENTS_REQUIRED';
  end if;

  select fecha
  into v_jornada_fecha
  from public.jornadas_venta
  where id = p_jornada_id
    and estado = 'abierta'
  for update;

  if not found then
    raise exception 'DAY_NOT_OPEN';
  end if;

  if v_jornada_fecha <> (timezone('America/Lima', now()))::date then
    raise exception 'ONLY_CURRENT_DAY';
  end if;

  if not exists (
    select 1
    from public.jornada_personal
    where jornada_id = p_jornada_id
      and persona_id = p_promotor_id
      and en_turno = true
  ) then
    raise exception 'PERSON_NOT_ON_SHIFT';
  end if;

  select id, applied_at
  into v_snapshot_id, v_snapshot_applied_at
  from public.inventory_snapshots
  where status = 'applied'
  order by applied_at desc nulls last, created_at desc
  limit 1;

  if v_snapshot_id is null then
    raise exception 'NO_APPLIED_SNAPSHOT';
  end if;

  -- Validar items, bloquear recursos y calcular total.
  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    begin
      v_producto_id := (v_item->>'producto_id')::uuid;
      v_cantidad := (v_item->>'cantidad')::integer;
      v_precio := round((v_item->>'precio_unitario')::numeric, 2);
    exception
      when others then
        raise exception 'INVALID_SALE_ITEM';
    end;

    v_serial := nullif(upper(regexp_replace(coalesce(v_item->>'serial', ''), '\s+', '', 'g')), '');

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'INVALID_QUANTITY';
    end if;

    if v_precio is null or v_precio < 0 then
      raise exception 'INVALID_PRICE';
    end if;

    select sku, nombre
    into v_producto_sku, v_producto_nombre
    from public.productos
    where id = v_producto_id
      and is_active = true;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    if v_serial is not null then
      if v_cantidad <> 1 then
        raise exception 'SERIAL_QUANTITY_MUST_BE_ONE';
      end if;

      if v_serial = any(v_seen_serials) then
        raise exception 'DUPLICATE_SERIAL_IN_SALE';
      end if;

      v_seen_serials := array_append(v_seen_serials, v_serial);

      perform pg_advisory_xact_lock(
        hashtextextended('sale-serial:' || v_serial, 0)
      );

      select i.almacen, i.ubicacion
      into v_almacen, v_ubicacion
      from public.inventory_snapshot_items i
      where i.snapshot_id = v_snapshot_id
        and i.producto_id = v_producto_id
        and upper(i.serial) = v_serial
        and lower(trim(i.almacen)) = lower('KIOSKO MALL IQUITOS - KIO37')
        and lower(trim(i.ubicacion)) = 'stock'
        and i.cantidad_disponible > 0
      limit 1;

      if not found then
        raise exception 'SERIAL_NOT_AVAILABLE';
      end if;

      if exists (
        select 1
        from public.venta_detalles vd
        join public.ventas v on v.id = vd.venta_id
        where upper(vd.serial) = v_serial
          and v.estado = 'confirmada'
          and v.fecha > v_snapshot_applied_at
      ) then
        raise exception 'SERIAL_ALREADY_SOLD';
      end if;
    else
      perform pg_advisory_xact_lock(
        hashtextextended('sale-product:' || v_producto_id::text, 0)
      );

      select
        coalesce(sum(i.cantidad_operativa), 0)::integer,
        max(i.almacen),
        max(i.ubicacion)
      into v_snapshot_stock, v_almacen, v_ubicacion
      from public.inventory_snapshot_items i
      where i.snapshot_id = v_snapshot_id
        and i.producto_id = v_producto_id
        and i.serial is null
        and lower(trim(i.almacen)) = lower('KIOSKO MALL IQUITOS - KIO37')
        and lower(trim(i.ubicacion)) = 'stock';

      select coalesce(sum(vd.cantidad), 0)::integer
      into v_sold_since_snapshot
      from public.venta_detalles vd
      join public.ventas v on v.id = vd.venta_id
      where vd.producto_id = v_producto_id
        and vd.serial is null
        and v.estado = 'confirmada'
        and v.fecha > v_snapshot_applied_at
        and lower(trim(coalesce(vd.almacen, ''))) =
          lower('KIOSKO MALL IQUITOS - KIO37')
        and lower(trim(coalesce(vd.ubicacion, ''))) = 'stock';

      v_available := greatest(
        coalesce(v_snapshot_stock, 0) - coalesce(v_sold_since_snapshot, 0),
        0
      );

      if v_cantidad > v_available then
        raise exception 'INSUFFICIENT_STOCK';
      end if;
    end if;

    v_total := v_total + (v_cantidad * v_precio);
  end loop;

  v_total := round(v_total, 2);

  for v_pago in
    select value from jsonb_array_elements(p_pagos)
  loop
    if coalesce(v_pago->>'metodo', '') not in (
      'efectivo', 'tarjeta', 'yape', 'plin', 'transferencia'
    ) then
      raise exception 'INVALID_PAYMENT_METHOD';
    end if;

    begin
      v_total_pagos := v_total_pagos +
        round((v_pago->>'monto')::numeric, 2);
    exception
      when others then
        raise exception 'INVALID_PAYMENT_AMOUNT';
    end;
  end loop;

  v_total_pagos := round(v_total_pagos, 2);

  if v_total_pagos <> v_total then
    raise exception 'PAYMENT_TOTAL_MISMATCH';
  end if;

  insert into public.ventas(
    promotor_id,
    jornada_id,
    fecha,
    total,
    observacion,
    estado,
    created_by
  )
  values (
    p_promotor_id,
    p_jornada_id,
    now(),
    v_total,
    nullif(trim(coalesce(p_observacion, '')), ''),
    'confirmada',
    auth.uid()
  )
  returning id into v_venta_id;

  -- Persistir detalles y salida de Kardex.
  for v_item in
    select value from jsonb_array_elements(p_items)
  loop
    v_producto_id := (v_item->>'producto_id')::uuid;
    v_cantidad := (v_item->>'cantidad')::integer;
    v_precio := round((v_item->>'precio_unitario')::numeric, 2);
    v_serial := nullif(upper(regexp_replace(coalesce(v_item->>'serial', ''), '\s+', '', 'g')), '');

    select sku, nombre
    into v_producto_sku, v_producto_nombre
    from public.productos
    where id = v_producto_id;

    if v_serial is not null then
      select i.almacen, i.ubicacion
      into v_almacen, v_ubicacion
      from public.inventory_snapshot_items i
      where i.snapshot_id = v_snapshot_id
        and i.producto_id = v_producto_id
        and upper(i.serial) = v_serial
      limit 1;
    else
      v_almacen := 'KIOSKO MALL IQUITOS - KIO37';
      v_ubicacion := 'Stock';
    end if;

    insert into public.venta_detalles(
      venta_id,
      producto_id,
      cantidad,
      precio_unitario,
      sku,
      descripcion,
      serial,
      almacen,
      ubicacion
    )
    values (
      v_venta_id,
      v_producto_id,
      v_cantidad,
      v_precio,
      v_producto_sku,
      v_producto_nombre,
      v_serial,
      v_almacen,
      v_ubicacion
    );

    insert into public.inventario_kardex(
      producto_id,
      snapshot_id,
      venta_id,
      serial,
      direccion,
      tipo,
      clasificacion,
      cantidad,
      almacen_origen,
      ubicacion_origen,
      fecha,
      detalle
    )
    values (
      v_producto_id,
      v_snapshot_id,
      v_venta_id,
      v_serial,
      'salida',
      'venta',
      'confirmado',
      v_cantidad,
      v_almacen,
      v_ubicacion,
      v_jornada_fecha,
      'Venta registrada en AdminGes'
    );
  end loop;

  insert into public.venta_pagos(
    venta_id,
    metodo,
    monto,
    referencia
  )
  select
    v_venta_id,
    value->>'metodo',
    round((value->>'monto')::numeric, 2),
    nullif(trim(coalesce(value->>'referencia', '')), '')
  from jsonb_array_elements(p_pagos);

  return v_venta_id;
end;
$function$;

revoke all on function public.register_sale(
  uuid, uuid, jsonb, jsonb, text
) from public;
grant execute on function public.register_sale(
  uuid, uuid, jsonb, jsonb, text
) to authenticated;

-- -----------------------------------------------------------------------------
-- 8. Evitar salidas pendientes duplicadas al reconciliar un snapshot.
-- Las ventas ya generan su propia salida en inventario_kardex.
-- -----------------------------------------------------------------------------
create or replace function public.filter_known_sales_from_reconciliation()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_previous_applied_at timestamptz;
  v_known_sales integer := 0;
begin
  if not (
    new.tipo = 'reconciliacion'
    and new.direccion = 'salida'
    and new.clasificacion = 'pendiente_venta'
  ) then
    return new;
  end if;

  select applied_at
  into v_previous_applied_at
  from public.inventory_snapshots
  where status = 'applied'
    and id <> new.snapshot_id
  order by applied_at desc nulls last, created_at desc
  limit 1;

  if new.serial is not null then
    if exists (
      select 1
      from public.venta_detalles vd
      join public.ventas v on v.id = vd.venta_id
      where upper(vd.serial) = upper(new.serial)
        and v.estado = 'confirmada'
        and (
          v_previous_applied_at is null
          or v.fecha > v_previous_applied_at
        )
    ) then
      return null;
    end if;

    return new;
  end if;

  select coalesce(sum(vd.cantidad), 0)::integer
  into v_known_sales
  from public.venta_detalles vd
  join public.ventas v on v.id = vd.venta_id
  where vd.producto_id = new.producto_id
    and vd.serial is null
    and v.estado = 'confirmada'
    and (
      v_previous_applied_at is null
      or v.fecha > v_previous_applied_at
    )
    and lower(trim(coalesce(vd.almacen, ''))) =
      lower(trim(coalesce(new.almacen_origen, '')))
    and lower(trim(coalesce(vd.ubicacion, ''))) =
      lower(trim(coalesce(new.ubicacion_origen, '')));

  new.cantidad := greatest(new.cantidad - v_known_sales, 0);

  if new.cantidad = 0 then
    return null;
  end if;

  return new;
end;
$function$;

drop trigger if exists inventario_kardex_filter_known_sales
on public.inventario_kardex;

create trigger inventario_kardex_filter_known_sales
before insert on public.inventario_kardex
for each row
execute function public.filter_known_sales_from_reconciliation();

-- -----------------------------------------------------------------------------
-- 9. Stock operativo = snapshot vigente - ventas confirmadas posteriores.
-- El físico continúa siendo el snapshot.
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
location_stock as (
  select
    lb.*,
    greatest(
      lb.cantidad_disponible_base - coalesce(sn.cantidad, 0),
      0
    )::bigint as cantidad_disponible,
    greatest(
      lb.stock_actual_base - coalesce(sn.cantidad, 0),
      0
    )::bigint as stock_actual
  from location_base lb
  left join sold_nonserial sn
    on sn.producto_id = lb.producto_id
   and sn.almacen_key = lb.almacen_key
   and sn.ubicacion_key = lb.ubicacion_key
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
values (5, 'registro_ventas_jornada');

commit;
