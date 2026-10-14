-- AdminGes - CORRECCION DE CUOTAS: AR/ECO PORCENTAJE Y LAMINAS EN SOLES
-- Requiere: 012_cuota_mensual_ciclo_comercial.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 12
  ) then
    raise exception 'Primero ejecuta 012_cuota_mensual_ciclo_comercial.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 13
  ) then
    raise exception 'La version 013 ya fue aplicada';
  end if;
end
$$;

-- Láminas es monetaria en todo el flujo de cuotas.
alter table public.jornadas_venta
  alter column cuota_laminas type numeric(12,2)
  using cuota_laminas::numeric(12,2);

alter table public.jornada_cierre_reportes
  alter column cuota_laminas type numeric(12,2)
  using cuota_laminas::numeric(12,2),
  alter column venta_laminas type numeric(12,2)
  using venta_laminas::numeric(12,2);

alter table public.cuotas_tienda_diarias
  alter column cuota_laminas type numeric(12,2)
  using cuota_laminas::numeric(12,2);

alter table public.cuotas_ciclos_comerciales
  alter column cuota_laminas type numeric(14,2)
  using cuota_laminas::numeric(14,2),
  add column cuota_ar_pct numeric(5,2) not null default 0
    check (cuota_ar_pct >= 0 and cuota_ar_pct <= 100),
  add column cuota_eco_pct numeric(5,2) not null default 0
    check (cuota_eco_pct >= 0 and cuota_eco_pct <= 100);

-- Reemplazar firmas antiguas para que PostgREST no vea sobrecargas ambiguas.
drop function if exists public.open_sales_day(
  date, numeric, integer, numeric, jsonb
);

create function public.open_sales_day(
  p_fecha date,
  p_cuota_amt numeric,
  p_cuota_laminas numeric,
  p_cuota_sc_plus numeric,
  p_equipo jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_jornada_id uuid;
  v_estado text;
  v_configurada boolean;
  v_member jsonb;
  v_persona_id uuid;
  v_hora time;
  v_vende_hoy boolean;
  v_puede_vender boolean;
  v_is_active boolean;
  v_estado_laboral text;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if p_fecha <> (timezone('America/Lima', now()))::date then
    raise exception 'ONLY_CURRENT_DAY';
  end if;

  if p_cuota_amt is null
    or p_cuota_laminas is null
    or p_cuota_sc_plus is null
    or p_cuota_amt < 0
    or p_cuota_laminas < 0
    or p_cuota_sc_plus < 0
  then
    raise exception 'INVALID_DAILY_TARGETS';
  end if;

  if jsonb_typeof(p_equipo) <> 'array'
    or jsonb_array_length(p_equipo) = 0
  then
    raise exception 'DAILY_TEAM_REQUIRED';
  end if;

  select id, estado, configurada
  into v_jornada_id, v_estado, v_configurada
  from public.jornadas_venta
  where fecha = p_fecha
  limit 1
  for update;

  if v_jornada_id is not null then
    if v_estado = 'cerrada' then
      raise exception 'DAY_ALREADY_CLOSED';
    end if;

    if v_configurada then
      raise exception 'DAY_ALREADY_CONFIGURED';
    end if;
  else
    if exists (
      select 1
      from public.jornadas_venta
      where estado = 'abierta'
    ) then
      raise exception 'ANOTHER_DAY_OPEN';
    end if;

    insert into public.jornadas_venta(
      fecha,
      estado,
      configurada,
      cuota_amt,
      cuota_laminas,
      cuota_sc_plus
    )
    values (
      p_fecha,
      'abierta',
      false,
      0,
      0,
      0
    )
    returning id into v_jornada_id;
  end if;

  delete from public.jornada_personal
  where jornada_id = v_jornada_id;

  for v_member in
    select value from jsonb_array_elements(p_equipo)
  loop
    begin
      v_persona_id := (v_member->>'persona_id')::uuid;
      v_hora := (v_member->>'hora_ingreso')::time;
      v_vende_hoy := coalesce((v_member->>'vende_hoy')::boolean, false);
    exception
      when others then
        raise exception 'INVALID_TEAM_MEMBER';
    end;

    if v_hora < time '09:00'
      or v_hora > time '19:00'
    then
      raise exception 'INVALID_ENTRY_TIME';
    end if;

    if exists (
      select 1
      from public.jornada_personal
      where jornada_id = v_jornada_id
        and persona_id = v_persona_id
    ) then
      raise exception 'DUPLICATE_TEAM_MEMBER';
    end if;

    select puede_vender, is_active, estado_laboral
    into v_puede_vender, v_is_active, v_estado_laboral
    from public.personas
    where id = v_persona_id;

    if not found or not v_is_active then
      raise exception 'PERSON_NOT_ACTIVE';
    end if;

    if v_estado_laboral = 'vacaciones' then
      raise exception 'PERSON_ON_VACATION';
    end if;

    if v_vende_hoy and not v_puede_vender then
      raise exception 'PERSON_CANNOT_SELL';
    end if;

    insert into public.jornada_personal(
      jornada_id,
      persona_id,
      disponible,
      vende_hoy,
      hora_ingreso_programada,
      en_turno,
      inicio_turno,
      fin_turno,
      updated_at
    )
    values (
      v_jornada_id,
      v_persona_id,
      true,
      v_vende_hoy,
      v_hora,
      false,
      null,
      null,
      now()
    );

    v_count := v_count + 1;
  end loop;

  if v_count = 0 then
    raise exception 'DAILY_TEAM_REQUIRED';
  end if;

  update public.jornadas_venta
  set
    configurada = true,
    cuota_amt = round(p_cuota_amt, 2),
    cuota_laminas = round(p_cuota_laminas, 2),
    cuota_sc_plus = round(p_cuota_sc_plus, 2)
  where id = v_jornada_id;

  return v_jornada_id;
end;
$function$;

revoke all on function public.open_sales_day(
  date, numeric, numeric, numeric, jsonb
) from public;
grant execute on function public.open_sales_day(
  date, numeric, numeric, numeric, jsonb
) to authenticated;

drop function if exists public.save_daily_store_quota(
  date, numeric, integer, numeric
);

create or replace function public.save_daily_store_quota(
  p_fecha date,
  p_cuota_amt numeric,
  p_cuota_laminas numeric,
  p_cuota_sc_plus numeric
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

  if p_fecha is null
    or p_cuota_amt is null
    or p_cuota_laminas is null
    or p_cuota_sc_plus is null
    or p_cuota_amt < 0
    or p_cuota_laminas < 0
    or p_cuota_sc_plus < 0
  then
    raise exception 'INVALID_DAILY_TARGETS';
  end if;

  if exists (
    select 1
    from public.jornadas_venta
    where fecha = p_fecha
      and configurada = true
  ) then
    raise exception 'QUOTA_DAY_LOCKED';
  end if;

  insert into public.cuotas_tienda_diarias(
    fecha,
    cuota_amt,
    cuota_laminas,
    cuota_sc_plus,
    origen,
    updated_at
  )
  values (
    p_fecha,
    round(p_cuota_amt, 2),
    round(p_cuota_laminas, 2),
    round(p_cuota_sc_plus, 2),
    'manual',
    now()
  )
  on conflict (fecha) do update
  set
    cuota_amt = excluded.cuota_amt,
    cuota_laminas = excluded.cuota_laminas,
    cuota_sc_plus = excluded.cuota_sc_plus,
    origen = 'manual',
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$function$;

revoke all on function public.save_daily_store_quota(
  date, numeric, numeric, numeric
) from public;

grant execute on function public.save_daily_store_quota(
  date, numeric, numeric, numeric
) to authenticated;

drop function if exists public.save_monthly_commercial_cycle(
  uuid, date, integer, numeric, numeric, numeric, numeric, numeric, integer, jsonb
);

create or replace function public.save_monthly_commercial_cycle(
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
    or p_cuota_ar_pct is null
    or p_cuota_eco_pct is null
    or p_cuota_hhp_fp < 0
    or p_cuota_hhp_mass < 0
    or p_cuota_tabs < 0
    or p_cuota_acc < 0
    or p_cuota_sc_plus < 0
    or p_cuota_laminas < 0
    or p_cuota_ar_pct < 0
    or p_cuota_ar_pct > 100
    or p_cuota_eco_pct < 0
    or p_cuota_eco_pct > 100
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
      cuota_ar_pct,
      cuota_eco_pct,
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
      round(p_cuota_laminas, 2),
      round(p_cuota_ar_pct, 2),
      round(p_cuota_eco_pct, 2),
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
      cuota_laminas = round(p_cuota_laminas, 2),
      cuota_ar_pct = round(p_cuota_ar_pct, 2),
      cuota_eco_pct = round(p_cuota_eco_pct, 2),
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
  uuid, date, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) from public;

grant execute on function public.save_monthly_commercial_cycle(
  uuid, date, integer, numeric, numeric, numeric, numeric, numeric, numeric, numeric, numeric, jsonb
) to authenticated;

-- El cierre diario calcula Láminas por subtotal vendido, no por unidades.
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
  v_venta_laminas numeric(12,2) := 0;
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
    coalesce(sum(vd.subtotal) filter (
      where public.sales_report_group(
        p.sku,
        p.nombre,
        coalesce(p.categoria_principal, p.categoria),
        p.categoria_venta,
        p.familia,
        p.variante
      ) = 'LAMINAS'
    ), 0)::numeric(12,2),
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
values (13, 'cuotas_ar_eco_pct_laminas_monto');

commit;
