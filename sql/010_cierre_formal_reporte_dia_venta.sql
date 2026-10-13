-- AdminGes - CIERRE FORMAL Y REPORTE DEL DIA DE VENTA
-- Requiere: 009_ventas_historial_reversa_ultimo_precio.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 9
  ) then
    raise exception 'Primero ejecuta 009_ventas_historial_reversa_ultimo_precio.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 10
  ) then
    raise exception 'La version 010 ya fue aplicada';
  end if;
end
$$;

-- -----------------------------------------------------------------------------
-- 1. Snapshot del reporte de cierre.
-- Se persisten cuota y venta para que un histórico nunca cambie después.
-- -----------------------------------------------------------------------------
create table public.jornada_cierre_reportes (
  jornada_id uuid primary key
    references public.jornadas_venta(id) on delete cascade,
  cuota_amt numeric(12,2) not null check (cuota_amt >= 0),
  venta_amt numeric(12,2) not null check (venta_amt >= 0),
  cuota_laminas integer not null check (cuota_laminas >= 0),
  venta_laminas integer not null check (venta_laminas >= 0),
  cuota_sc_plus numeric(12,2) not null check (cuota_sc_plus >= 0),
  venta_sc_plus numeric(12,2) not null check (venta_sc_plus >= 0),
  comentarios text,
  closed_by uuid not null,
  created_at timestamptz not null default now()
);

create table public.jornada_cierre_quiebres (
  id bigint generated always as identity primary key,
  jornada_id uuid not null
    references public.jornada_cierre_reportes(jornada_id) on delete cascade,
  grupo text not null check (
    grupo in (
      'HHP_SERIE_S',
      'HHP_SERIE_A',
      'HHP_SERIE_Z',
      'TABLETS',
      'WEA',
      'LAMINAS'
    )
  ),
  venta_unid integer not null default 0 check (venta_unid >= 0),
  quiebre boolean not null default false,
  detalle text,
  unique (jornada_id, grupo)
);

create index jornada_cierre_reportes_created_idx
  on public.jornada_cierre_reportes(created_at desc);

alter table public.jornada_cierre_reportes enable row level security;
alter table public.jornada_cierre_quiebres enable row level security;

create policy jornada_cierre_reportes_authenticated_all
on public.jornada_cierre_reportes for all to authenticated
using (true) with check (true);

create policy jornada_cierre_quiebres_authenticated_all
on public.jornada_cierre_quiebres for all to authenticated
using (true) with check (true);

grant select, insert, update, delete
on public.jornada_cierre_reportes to authenticated;

grant select, insert, update, delete
on public.jornada_cierre_quiebres to authenticated;

grant usage, select on all sequences in schema public to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Clasificación de cierre en PostgreSQL.
-- La categoría principal manda: ACC nunca se transforma en celular solo por
-- contener "Galaxy A/S/Z" en el nombre (ej. CASE GALAXY A57).
-- -----------------------------------------------------------------------------
create or replace function public.sales_report_group(
  p_sku text,
  p_nombre text,
  p_categoria_principal text,
  p_categoria_venta text,
  p_familia text,
  p_variante text
)
returns text
language plpgsql
immutable
as $function$
declare
  v_sku text := upper(trim(coalesce(p_sku, '')));
  v_nombre text := upper(trim(coalesce(p_nombre, '')));
  v_principal text := upper(trim(coalesce(p_categoria_principal, '')));
  v_venta text := upper(trim(coalesce(p_categoria_venta, '')));
  v_familia text := upper(trim(coalesce(p_familia, '')));
  v_variante text := upper(trim(coalesce(p_variante, '')));
  v_modelo text;
begin
  if (
    v_principal like '%MARCAS PROPIAS%'
    and (v_venta like '%LAMINA%' or v_familia like '%LAMINA%')
  ) or v_venta like '%LAMINA%'
    or v_familia like '%LAMINA%'
  then
    return 'LAMINAS';
  end if;

  if v_principal ~ '(^|[ /])ACC([ /]|$)'
    or v_principal like '%ACCESORIO%'
    or v_principal like '%ACCESSOR%'
  then
    if v_venta like '%WEARABLE%'
      or v_venta ~ '(^|[ /])WEA([ /]|$)'
      or v_sku like 'WEA%'
      or v_nombre like 'WEA %'
      or v_nombre like '%GALAXY BUDS%'
      or v_nombre ~ '(^|[ /])BUDS([ /]|$)'
    then
      return 'WEA';
    end if;

    return 'ACCESORIOS';
  end if;

  if v_principal ~ '(^|[ /])WEA([ /]|$)'
    or v_principal like '%WEARABLE%'
  then
    return 'WEA';
  end if;

  if v_principal ~ '(^|[ /])TAB([ /]|$)'
    or v_principal like '%TABLET%'
    or v_principal like '%EXHIBICIONES TAB%'
  then
    return 'TABLETS';
  end if;

  if v_principal ~ '(^|[ /])HHP([ /]|$)'
    or v_principal like '%EXHIBICIONES HHP%'
  then
    v_modelo := concat_ws(' ', v_familia, v_variante, v_nombre);

    if v_modelo ~ '\mGALAXY[[:space:]]+A[0-9]' then
      return 'HHP_SERIE_A';
    end if;

    if v_modelo ~ '\mGALAXY[[:space:]]+S[0-9]' then
      return 'HHP_SERIE_S';
    end if;

    if v_modelo ~ '\mGALAXY[[:space:]]+Z\M' then
      return 'HHP_SERIE_Z';
    end if;

    return 'OTROS';
  end if;

  if v_principal = '' then
    v_modelo := concat_ws(
      ' ',
      v_venta,
      v_familia,
      v_variante,
      v_nombre,
      v_sku
    );

    if v_modelo like '%GALAXY TAB%' then
      return 'TABLETS';
    end if;

    if v_sku like 'WEA%'
      or v_modelo like '%GALAXY BUDS%'
      or v_modelo ~ '(^|[ /])BUDS([ /]|$)'
      or v_modelo like '%GALAXY WATCH%'
    then
      return 'WEA';
    end if;

    if v_modelo ~ '\mGALAXY[[:space:]]+A[0-9]' then
      return 'HHP_SERIE_A';
    end if;

    if v_modelo ~ '\mGALAXY[[:space:]]+S[0-9]' then
      return 'HHP_SERIE_S';
    end if;

    if v_modelo ~ '\mGALAXY[[:space:]]+Z\M' then
      return 'HHP_SERIE_Z';
    end if;
  end if;

  return 'OTROS';
end;
$function$;

-- -----------------------------------------------------------------------------
-- 3. Cierre formal del día.
-- Los valores de venta se calculan desde ventas confirmadas; el cliente solo
-- envía quiebres/detalles y comentarios.
-- -----------------------------------------------------------------------------
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

  select coalesce(sum(v.total), 0)::numeric(12,2)
  into v_venta_amt
  from public.ventas v
  where v.jornada_id = p_jornada_id
    and v.estado = 'confirmada';

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

revoke all on function public.close_sales_day_with_report(
  uuid, jsonb, text
) from public;

grant execute on function public.close_sales_day_with_report(
  uuid, jsonb, text
) to authenticated;

insert into public.app_sql_versions(version, name)
values (10, 'cierre_formal_reporte_dia_venta');

commit;
