-- AdminGes - INICIO AUTOMATICO DEL EQUIPO AL APERTURAR LA JORNADA
-- Requiere: 013_cuotas_ar_eco_pct_laminas_monto.sql
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

do $$
begin
  if not exists (
    select 1 from public.app_sql_versions where version = 13
  ) then
    raise exception 'Primero ejecuta 013_cuotas_ar_eco_pct_laminas_monto.sql';
  end if;

  if exists (
    select 1 from public.app_sql_versions where version = 14
  ) then
    raise exception 'La version 014 ya fue aplicada';
  end if;
end
$$;

-- La apertura/configuracion de la jornada es el unico inicio de turno.
-- El RPC open_sales_day primero inserta el equipo y despues configura la jornada.
-- Este trigger inicia atomicamente a TODOS los integrantes disponibles,
-- incluidos supervisores que no venden (vende_hoy = false).
create or replace function public.activate_sales_day_team()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
begin
  update public.jornada_personal
  set
    en_turno = true,
    inicio_turno = coalesce(inicio_turno, now()),
    fin_turno = null,
    updated_at = now()
  where jornada_id = new.id
    and disponible = true;

  return new;
end;
$function$;

drop trigger if exists jornadas_venta_activate_team
  on public.jornadas_venta;

create trigger jornadas_venta_activate_team
after update of configurada on public.jornadas_venta
for each row
when (
  old.configurada is distinct from new.configurada
  and new.configurada = true
  and new.estado = 'abierta'
)
execute function public.activate_sales_day_team();

-- Regularizar jornadas abiertas y configuradas antes de aplicar el cambio.
-- No reabrir turnos de jornadas cerradas ni modificar su historico.
update public.jornada_personal jp
set
  en_turno = true,
  inicio_turno = coalesce(jp.inicio_turno, j.opened_at, now()),
  fin_turno = null,
  updated_at = now()
from public.jornadas_venta j
where jp.jornada_id = j.id
  and j.estado = 'abierta'
  and j.configurada = true
  and jp.disponible = true
  and (
    jp.en_turno = false
    or jp.inicio_turno is null
    or jp.fin_turno is not null
  );

-- Se elimina la operacion individual: no debe poder finalizarse un turno
-- mientras la jornada permanece abierta. El cierre general sigue igual.
revoke execute on function public.set_sales_shift(uuid, uuid, boolean)
  from authenticated;

insert into public.app_sql_versions(version, name)
values (14, 'inicio_automatico_equipo_jornada');

commit;
