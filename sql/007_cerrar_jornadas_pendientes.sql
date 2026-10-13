-- AdminGes - CIERRE DE JORNADAS PENDIENTES
-- Requiere: 006_ventas_cuotas_equipo_diario.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 6
  ) then
    raise exception 'Primero ejecuta 006_ventas_cuotas_equipo_diario.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 7
  ) then
    raise exception 'La version 007 ya fue aplicada';
  end if;
end
$$;

-- Permite cerrar cualquier jornada que siga abierta, incluso jornadas
-- antiguas creadas antes de la configuracion de cuotas/equipo de SQL 006.
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
    closed_at = coalesce(closed_at, now())
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

insert into public.app_sql_versions(version, name)
values (7, 'cerrar_jornadas_pendientes');

commit;
