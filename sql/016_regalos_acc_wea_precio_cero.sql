-- AdminGes 016 · Regalos ACC / WEA con precio unitario S/ 0.00.
-- Aplicar después de SQL 015, desde Supabase SQL Editor.
-- Preserva todos los registros, stock, salidas de Kardex y pagos previos.
begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 15
  ) then
    raise exception 'Primero ejecuta sql/015_trade_in_comisiones_metodos_pago.sql';
  end if;
  if exists (
    select 1 from public.app_sql_versions where version = 16
  ) then
    raise exception 'La version 016 ya fue aplicada';
  end if;
end
$$;

-- El último precio SUGERIDO es el último importe positivo registrado;
-- un regalo no debe reemplazar el precio de venta sugerido.
create or replace view public.ultimo_precio_venta
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
  and vd.precio_unitario > 0
order by vd.producto_id, v.fecha desc, vd.id desc;

grant select on public.ultimo_precio_venta to authenticated;

-- Mantener firma RPC original. Actualizar validación de cero por grupo
-- y venta con pagos vacíos solo si TODOS los conceptos suman S/ 0.00.
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
  v_report_group text;
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

  if coalesce(jsonb_typeof(p_pagos), '') <> 'array' then
    raise exception 'INVALID_PAYMENT_DATA';
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

    select p.sku, p.nombre,
      public.sales_report_group(
        p.sku, p.nombre,
        coalesce(p.categoria_principal, p.categoria),
        p.categoria_venta, p.familia, p.variante
      )
    into v_producto_sku, v_producto_nombre, v_report_group
    from public.productos p
    where p.id = v_producto_id
      and p.is_active = true;

    if not found then
      raise exception 'PRODUCT_NOT_FOUND';
    end if;

    -- Solo ACC y WEA pueden entregarse como regalo (costo S/ 0).
    -- El grupo lo determina Supabase, nunca el cliente.
    if v_precio = 0
      and v_report_group not in ('ACCESORIOS', 'WEA')
    then
      raise exception 'ZERO_PRICE_RESTRICTED';
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

  -- Regalo puro: venta válida de S/ 0 sin método de pago inexistente.
  -- Venta con importe: continúa requiriendo cobro real.
  if v_total > 0 and jsonb_array_length(p_pagos) = 0 then
    raise exception 'SALE_PAYMENTS_REQUIRED';
  end if;
  if v_total = 0 and jsonb_array_length(p_pagos) > 0 then
    raise exception 'FREE_SALE_NO_PAYMENT';
  end if;

  for v_pago in
    select value from jsonb_array_elements(p_pagos)
  loop
    if not exists (
      select 1
      from public.metodos_pago mp
      where mp.codigo = lower(trim(coalesce(v_pago->>'metodo', '')))
        and mp.is_active = true
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
    lower(trim(value->>'metodo')),
    round((value->>'monto')::numeric, 2),
    nullif(trim(coalesce(value->>'referencia', '')), '')
  from jsonb_array_elements(p_pagos);

  return v_venta_id;
end;
$function$;


revoke all on function public.register_sale(uuid, uuid, jsonb, jsonb, text)
  from public;
grant execute on function public.register_sale(uuid, uuid, jsonb, jsonb, text)
  to authenticated;

insert into public.app_sql_versions(version, name)
values (16, 'regalos_acc_wea_precio_cero');

commit;
