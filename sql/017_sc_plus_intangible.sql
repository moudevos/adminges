-- AdminGes 017: 64 SKU SC+ intangibles, cuatro coberturas, 8 escalas, 1 y 2 años.
-- Requiere SQL 016. Ejecutar en Supabase SQL Editor.
begin;
do $$
begin
 if not exists(select 1 from public.app_sql_versions where version=16)
 then raise exception 'Primero ejecuta SQL 016'; end if;
 if exists(select 1 from public.app_sql_versions where version=17)
 then raise exception 'SQL 017 ya fue ejecutado'; end if;
end $$;

create table public.sc_plus_planes (
 producto_id uuid primary key references public.productos(id) on delete restrict,
 sku text not null unique,
 cobertura text not null check(cobertura in ('TR','ROBO','PANTALLA','DANOS')),
 escala smallint not null check(escala between 0 and 7),
 min_etiqueta numeric(12,2) not null,
 max_etiqueta numeric(12,2) not null,
 vigencia_anios smallint not null check(vigencia_anios in (1,2)),
 is_active boolean not null default true,
 unique(cobertura,escala,vigencia_anios)
);
alter table public.sc_plus_planes enable row level security;
create policy sc_plus_read on public.sc_plus_planes
 for select to authenticated using ((select auth.uid()) is not null);
grant select on public.sc_plus_planes to authenticated;

-- Los SKU originales se generan exactamente según la hoja proporcionada.
create temporary table sc_plus_seed on commit drop as
with tiers(escala, min_etiqueta, max_etiqueta) as (
 values (0,400,1000),(1,1001,2000),(2,2001,3000),(3,3001,4000),
        (4,4001,5000),(5,5001,6000),(6,6001,7000),(7,7001,10000)
), coverages(cobertura, codigo, nombre) as (
 values ('TR','DA_ROBO','Todo riesgo'),('ROBO','ROBO','Robo'),
        ('PANTALLA','PANTALLA','Daño de pantalla'),
        ('DANOS','DA','Pantalla e ingreso de líquidos')
)
select c.cobertura,c.nombre,c.codigo,t.escala,
 t.min_etiqueta,t.max_etiqueta,y.vigencia_anios,
 (case when y.vigencia_anios=2 then 'BA_' else '' end) ||
 'SSC+' || c.codigo || t.escala::text as sku
from tiers t cross join coverages c
cross join (values(1),(2)) y(vigencia_anios);

insert into public.productos (
 sku,nombre,marca,categoria,categoria_principal,categoria_venta,
 familia,variante,precio,costo,is_active
)
select sku,'SC+ '||nombre||' · '||vigencia_anios||' año(s) · Escala '||escala,
 'Samsung','SERVICIOS','SERVICIOS','SC+','SC+',nombre,0,0,true
from sc_plus_seed
on conflict(sku) do nothing;

do $$
begin
 if exists(
  select 1 from sc_plus_seed s join public.productos p using(sku)
  where upper(coalesce(p.categoria_venta,''))<>'SC+'
 ) then
  raise exception 'Colisión: un SKU SC+ pertenece a un producto físico';
 end if;
end $$;

insert into public.sc_plus_planes(
 producto_id,sku,cobertura,escala,min_etiqueta,max_etiqueta,vigencia_anios
)
select p.id,s.sku,s.cobertura,s.escala,s.min_etiqueta,s.max_etiqueta,s.vigencia_anios
from sc_plus_seed s join public.productos p using(sku);

alter table public.venta_detalles
 add column sc_plus_precio_etiqueta numeric(12,2)
   check(sc_plus_precio_etiqueta is null or sc_plus_precio_etiqueta>0),
 add column sc_plus_equipo_producto_id uuid
   references public.productos(id) on delete restrict;

-- Datos de etiqueta se validan en DB, SC+ no consume inventario.
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
  v_intangible boolean;
  v_label numeric(12,2);
  v_related_device uuid;
  v_min_label numeric(12,2);
  v_max_label numeric(12,2);
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

  -- Solo los productos físicos requieren snapshot aplicado.

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

    select min_etiqueta, max_etiqueta
    into v_min_label, v_max_label
    from public.sc_plus_planes
    where producto_id = v_producto_id and is_active = true;
    v_intangible := found;

    if v_intangible then
      begin
        v_label := (v_item->>'precio_equipo_etiqueta')::numeric(12,2);
        v_related_device := nullif(v_item->>'equipo_producto_id', '')::uuid;
      exception when others then
        raise exception 'SC_PLUS_LABEL_PRICE_REQUIRED';
      end;
      if v_label is null or ceil(v_label) < v_min_label or ceil(v_label) > v_max_label then
        raise exception 'SC_PLUS_LABEL_PRICE_OUT_OF_RANGE';
      end if;
      if v_precio <= 0 or v_cantidad <> 1 or v_serial is not null then
        raise exception 'INVALID_SC_PLUS_LINE';
      end if;
      if v_related_device is not null and not exists (
        select 1 from jsonb_array_elements(p_items) e
        join public.productos p on p.id = (e.value->>'producto_id')::uuid
        where p.id = v_related_device
          and public.sales_report_group(
            p.sku,p.nombre,coalesce(p.categoria_principal,p.categoria),
            p.categoria_venta,p.familia,p.variante
          ) in ('HHP_SERIE_S','HHP_SERIE_A','HHP_SERIE_Z','TABLETS')
      ) then
        raise exception 'SC_PLUS_DEVICE_NOT_IN_SALE';
      end if;
    elsif v_snapshot_id is null then
      raise exception 'NO_APPLIED_SNAPSHOT';
    end if;

    -- Solo ACC y WEA pueden entregarse como regalo (costo S/ 0).
    -- El grupo lo determina Supabase, nunca el cliente.
    if v_precio = 0
      and v_report_group not in ('ACCESORIOS', 'WEA')
    then
      raise exception 'ZERO_PRICE_RESTRICTED';
    end if;

    if v_intangible then
      null; -- SC+ no requiere stock o serie.
    elsif v_serial is not null then
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

    select exists (select 1 from public.sc_plus_planes where producto_id=v_producto_id)
    into v_intangible;
    if v_intangible then
      v_almacen := null;
      v_ubicacion := null;
      v_label := (v_item->>'precio_equipo_etiqueta')::numeric(12,2);
      v_related_device := nullif(v_item->>'equipo_producto_id','')::uuid;
    else
      v_label := null;
      v_related_device := null;
    end if;

    if v_intangible then
      null;
    elsif v_serial is not null then
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
      ubicacion,
      sc_plus_precio_etiqueta,
      sc_plus_equipo_producto_id
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
      v_ubicacion,
      v_label,
      v_related_device
    );

    if not v_intangible then
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
    end if;
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
revoke all on function public.register_sale(uuid,uuid,jsonb,jsonb,text) from public;
grant execute on function public.register_sale(uuid,uuid,jsonb,jsonb,text) to authenticated;

-- Reversa sin añadir entradas ficticias al Kardex.
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
  where vd.venta_id = p_venta_id
    and not exists (select 1 from public.sc_plus_planes cp where cp.producto_id = vd.producto_id);
end;
$function$;
revoke all on function public.reverse_sale(uuid,text) from public;
grant execute on function public.reverse_sale(uuid,text) to authenticated;

create or replace function public.close_sales_day_with_report(
  p_jornada_id uuid,
  p_quiebres jsonb,
  p_comentarios text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_jornada public.jornadas_venta%rowtype;
  v_venta_amt numeric(12,2) := 0;
  v_venta_laminas integer := 0;
  v_venta_sc_plus numeric(12,2) := 0;
  v_item jsonb;
  v_group text;
  v_quiebre boolean;
  v_detalle text;
  v_seen text[] := array[]::text[];
  v_units integer;
  v_expected_groups text[] := array[
    'HHP_SERIE_S',
    'HHP_SERIE_A',
    'HHP_SERIE_Z',
    'TABLETS',
    'WEA',
    'LAMINAS'
  ];
  v_group_item text;
  v_report jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select *
  into v_jornada
  from public.jornadas_venta
  where id = p_jornada_id
  for update;

  if not found then
    raise exception 'DAY_NOT_FOUND';
  end if;

  if v_jornada.estado <> 'abierta' then
    raise exception 'DAY_NOT_OPEN';
  end if;

  if not v_jornada.configurada then
    raise exception 'DAY_NOT_CONFIGURED';
  end if;

  if exists (
    select 1
    from public.jornada_cierre_reportes
    where jornada_id = p_jornada_id
  ) then
    raise exception 'DAY_REPORT_ALREADY_EXISTS';
  end if;

  if jsonb_typeof(p_quiebres) <> 'array' then
    raise exception 'BREAKAGE_DATA_REQUIRED';
  end if;

  -- AMT debe reflejar solo HHP, Tablets y ACC, no SC+ ni Láminas.
  select coalesce(sum(vd.subtotal), 0)::numeric(12,2)
  into v_venta_amt
  from public.ventas v
  join public.venta_detalles vd on vd.venta_id = v.id
  join public.productos p on p.id = vd.producto_id
  where v.jornada_id = p_jornada_id
    and v.estado = 'confirmada'
    and public.sales_report_group(
      p.sku, p.nombre,
      coalesce(p.categoria_principal, p.categoria),
      p.categoria_venta, p.familia, p.variante
    ) in ('HHP_SERIE_S','HHP_SERIE_A','HHP_SERIE_Z','TABLETS','ACCESORIOS','WEA');

  select
    coalesce(sum(vd.cantidad) filter (
      where public.sales_report_group(
        p.sku,
        p.nombre,
        coalesce(p.categoria_principal, p.categoria),
        p.categoria_venta,
        p.familia,
        p.variante
      ) = 'LAMINAS'
    ), 0)::integer,
    coalesce(sum(vd.subtotal) filter (
      where upper(
        concat_ws(
          ' ',
          p.categoria_principal,
          p.categoria,
          p.categoria_venta,
          p.familia,
          p.variante,
          p.nombre
        )
      ) like '%SC+%'
      or upper(
        concat_ws(
          ' ',
          p.categoria_principal,
          p.categoria,
          p.categoria_venta,
          p.familia,
          p.variante,
          p.nombre
        )
      ) like '%SC PLUS%'
      or upper(
        concat_ws(
          ' ',
          p.categoria_principal,
          p.categoria,
          p.categoria_venta,
          p.familia,
          p.variante,
          p.nombre
        )
      ) like '%SAMSUNG CARE%'
    ), 0)::numeric(12,2)
  into v_venta_laminas, v_venta_sc_plus
  from public.venta_detalles vd
  join public.ventas v on v.id = vd.venta_id
  join public.productos p on p.id = vd.producto_id
  where v.jornada_id = p_jornada_id
    and v.estado = 'confirmada';

  insert into public.jornada_cierre_reportes(
    jornada_id,
    cuota_amt,
    venta_amt,
    cuota_laminas,
    venta_laminas,
    cuota_sc_plus,
    venta_sc_plus,
    comentarios,
    closed_by
  )
  values (
    p_jornada_id,
    v_jornada.cuota_amt,
    v_venta_amt,
    v_jornada.cuota_laminas,
    v_venta_laminas,
    v_jornada.cuota_sc_plus,
    v_venta_sc_plus,
    nullif(trim(coalesce(p_comentarios, '')), ''),
    auth.uid()
  );

  for v_item in
    select value from jsonb_array_elements(p_quiebres)
  loop
    v_group := upper(trim(coalesce(v_item->>'grupo', '')));

    if not (v_group = any(v_expected_groups)) then
      raise exception 'INVALID_BREAKAGE_GROUP';
    end if;

    if v_group = any(v_seen) then
      raise exception 'DUPLICATE_BREAKAGE_GROUP';
    end if;

    v_seen := array_append(v_seen, v_group);

    begin
      v_quiebre := coalesce((v_item->>'quiebre')::boolean, false);
    exception
      when others then
        raise exception 'INVALID_BREAKAGE_DATA';
    end;

    v_detalle := nullif(trim(coalesce(v_item->>'detalle', '')), '');

    if v_quiebre and v_detalle is null then
      raise exception 'BREAKAGE_DETAIL_REQUIRED';
    end if;

    select coalesce(sum(vd.cantidad), 0)::integer
    into v_units
    from public.venta_detalles vd
    join public.ventas v on v.id = vd.venta_id
    join public.productos p on p.id = vd.producto_id
    where v.jornada_id = p_jornada_id
      and v.estado = 'confirmada'
      and public.sales_report_group(
        p.sku,
        p.nombre,
        coalesce(p.categoria_principal, p.categoria),
        p.categoria_venta,
        p.familia,
        p.variante
      ) = v_group;

    insert into public.jornada_cierre_quiebres(
      jornada_id,
      grupo,
      venta_unid,
      quiebre,
      detalle
    )
    values (
      p_jornada_id,
      v_group,
      v_units,
      v_quiebre,
      v_detalle
    );
  end loop;

  foreach v_group_item in array v_expected_groups
  loop
    if not (v_group_item = any(v_seen)) then
      select coalesce(sum(vd.cantidad), 0)::integer
      into v_units
      from public.venta_detalles vd
      join public.ventas v on v.id = vd.venta_id
      join public.productos p on p.id = vd.producto_id
      where v.jornada_id = p_jornada_id
        and v.estado = 'confirmada'
        and public.sales_report_group(
          p.sku,
          p.nombre,
          coalesce(p.categoria_principal, p.categoria),
          p.categoria_venta,
          p.familia,
          p.variante
        ) = v_group_item;

      insert into public.jornada_cierre_quiebres(
        jornada_id,
        grupo,
        venta_unid,
        quiebre,
        detalle
      )
      values (
        p_jornada_id,
        v_group_item,
        v_units,
        false,
        null
      );
    end if;
  end loop;

  update public.jornadas_venta
  set
    estado = 'cerrada',
    closed_at = now()
  where id = p_jornada_id;

  update public.jornada_personal
  set
    en_turno = false,
    fin_turno = coalesce(fin_turno, now()),
    updated_at = now()
  where jornada_id = p_jornada_id
    and en_turno = true;

  select jsonb_build_object(
    'jornada_id', r.jornada_id,
    'cuota_amt', r.cuota_amt,
    'venta_amt', r.venta_amt,
    'cuota_laminas', r.cuota_laminas,
    'venta_laminas', r.venta_laminas,
    'cuota_sc_plus', r.cuota_sc_plus,
    'venta_sc_plus', r.venta_sc_plus,
    'comentarios', r.comentarios,
    'created_at', r.created_at,
    'quiebres', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'grupo', q.grupo,
            'venta_unid', q.venta_unid,
            'quiebre', q.quiebre,
            'detalle', q.detalle
          )
          order by case q.grupo
            when 'HHP_SERIE_S' then 1
            when 'HHP_SERIE_A' then 2
            when 'HHP_SERIE_Z' then 3
            when 'TABLETS' then 4
            when 'WEA' then 5
            when 'LAMINAS' then 6
            else 99
          end
        )
        from public.jornada_cierre_quiebres q
        where q.jornada_id = r.jornada_id
      ),
      '[]'::jsonb
    )
  )
  into v_report
  from public.jornada_cierre_reportes r
  where r.jornada_id = p_jornada_id;

  return v_report;
end;
$function$;
revoke all on function public.close_sales_day_with_report(uuid,jsonb,text) from public;
grant execute on function public.close_sales_day_with_report(uuid,jsonb,text) to authenticated;

insert into public.app_sql_versions(version,name)
values(17,'sc_plus_intangible_64_skus');
commit;