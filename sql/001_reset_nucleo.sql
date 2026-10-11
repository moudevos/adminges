-- AdminGes - RESET COMPLETO DEL NUCLEO
-- ADVERTENCIA: este script elimina los datos anteriores de AdminGes y los usuarios Auth.
-- Ejecutar manualmente en Supabase > SQL Editor.
-- No usa Supabase Migrations.

begin;

-- -----------------------------------------------------------------------------
-- 1. Limpiar la arquitectura anterior
-- -----------------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;

drop view if exists public.inventario_stock cascade;

drop function if exists public.current_user_role() cascade;
drop function if exists public.current_user_permissions() cascade;
drop function if exists public.can_access_store(uuid) cascade;
drop function if exists public.touch_app_session(text, text) cascade;
drop function if exists public.revoke_current_app_session(text) cascade;
drop function if exists public.check_login_rate_limit(text, text) cascade;
drop function if exists public.record_login_attempt(text, text, boolean) cascade;
drop function if exists public.is_current_app_session_active() cascade;
drop function if exists public.handle_new_user() cascade;
drop function if exists public.set_updated_at() cascade;

drop table if exists public.venta_detalles cascade;
drop table if exists public.ventas cascade;
drop table if exists public.cuotas_diarias cascade;
drop table if exists public.cuotas_mensuales cascade;
drop table if exists public.inventario_movimientos cascade;
drop table if exists public.productos cascade;
drop table if exists public.persona_stores cascade;
drop table if exists public.persona_clusters cascade;
drop table if exists public.persona_zones cascade;
drop table if exists public.store_supervisors cascade;
drop table if exists public.stores cascade;
drop table if exists public.clusters cascade;
drop table if exists public.zones cascade;
drop table if exists public.login_attempts cascade;
drop table if exists public.app_sessions cascade;
drop table if exists public.user_permissions cascade;
drop table if exists public.role_permissions cascade;
drop table if exists public.permissions cascade;
drop table if exists public.system_roles cascade;
drop table if exists public.promoters cascade;
drop table if exists public.personas cascade;
drop table if exists public.puestos cascade;
drop table if exists public.profiles cascade;
drop table if exists public.app_sql_versions cascade;

drop type if exists public.app_role cascade;

-- Reset de usuarios de la aplicación. Luego crea UN usuario desde Authentication > Users.
delete from auth.users;

-- -----------------------------------------------------------------------------
-- 2. Control de versión SQL
-- -----------------------------------------------------------------------------
create table public.app_sql_versions (
  version integer primary key,
  name text not null,
  applied_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 3. Personal
-- -----------------------------------------------------------------------------
create table public.puestos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.puestos (nombre)
values ('Promotor');

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  puesto_id uuid not null references public.puestos(id) on delete restrict,
  nombres text not null,
  apellidos text not null,
  documento text unique,
  telefono text,
  email text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index personas_puesto_idx on public.personas(puesto_id);
create index personas_nombre_idx on public.personas(apellidos, nombres);

-- -----------------------------------------------------------------------------
-- 4. Inventario
-- -----------------------------------------------------------------------------
create table public.productos (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  nombre text not null,
  marca text,
  categoria text,
  costo numeric(12,2) not null default 0 check (costo >= 0),
  precio numeric(12,2) not null default 0 check (precio >= 0),
  stock_minimo integer not null default 0 check (stock_minimo >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index productos_nombre_idx on public.productos(nombre);
create index productos_categoria_idx on public.productos(categoria);

create table public.inventario_movimientos (
  id bigint generated always as identity primary key,
  producto_id uuid not null references public.productos(id) on delete restrict,
  tipo text not null check (
    tipo in ('carga', 'ajuste_entrada', 'ajuste_salida', 'venta', 'anulacion_venta')
  ),
  cantidad integer not null check (cantidad > 0),
  costo_unitario numeric(12,2) check (costo_unitario is null or costo_unitario >= 0),
  referencia text,
  nota text,
  fecha timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index inventario_movimientos_producto_fecha_idx
  on public.inventario_movimientos(producto_id, fecha desc);
create index inventario_movimientos_tipo_fecha_idx
  on public.inventario_movimientos(tipo, fecha desc);

create view public.inventario_stock
with (security_invoker = true)
as
select
  p.id,
  p.sku,
  p.nombre,
  p.marca,
  p.categoria,
  p.costo,
  p.precio,
  p.stock_minimo,
  p.is_active,
  coalesce(
    sum(
      case
        when im.tipo in ('carga', 'ajuste_entrada', 'anulacion_venta') then im.cantidad
        when im.tipo in ('ajuste_salida', 'venta') then -im.cantidad
        else 0
      end
    ),
    0
  )::bigint as stock_actual,
  (
    coalesce(
      sum(
        case
          when im.tipo in ('carga', 'ajuste_entrada', 'anulacion_venta') then im.cantidad
          when im.tipo in ('ajuste_salida', 'venta') then -im.cantidad
          else 0
        end
      ),
      0
    ) * p.costo
  )::numeric(14,2) as valor_stock
from public.productos p
left join public.inventario_movimientos im on im.producto_id = p.id
group by
  p.id, p.sku, p.nombre, p.marca, p.categoria,
  p.costo, p.precio, p.stock_minimo, p.is_active;

-- -----------------------------------------------------------------------------
-- 5. Ventas
-- -----------------------------------------------------------------------------
create table public.ventas (
  id uuid primary key default gen_random_uuid(),
  promotor_id uuid not null references public.personas(id) on delete restrict,
  fecha timestamptz not null default now(),
  total numeric(12,2) not null default 0 check (total >= 0),
  observacion text,
  created_at timestamptz not null default now()
);

create index ventas_promotor_fecha_idx on public.ventas(promotor_id, fecha desc);

create table public.venta_detalles (
  id bigint generated always as identity primary key,
  venta_id uuid not null references public.ventas(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  subtotal numeric(12,2) generated always as (cantidad * precio_unitario) stored
);

create index venta_detalles_venta_idx on public.venta_detalles(venta_id);
create index venta_detalles_producto_idx on public.venta_detalles(producto_id);

-- -----------------------------------------------------------------------------
-- 6. Cuotas
-- -----------------------------------------------------------------------------
create table public.cuotas_diarias (
  id uuid primary key default gen_random_uuid(),
  promotor_id uuid not null references public.personas(id) on delete cascade,
  fecha date not null,
  monto numeric(12,2) not null check (monto >= 0),
  created_at timestamptz not null default now(),
  unique (promotor_id, fecha)
);

create table public.cuotas_mensuales (
  id uuid primary key default gen_random_uuid(),
  promotor_id uuid not null references public.personas(id) on delete cascade,
  mes date not null,
  monto numeric(12,2) not null check (monto >= 0),
  created_at timestamptz not null default now(),
  unique (promotor_id, mes),
  check (mes = date_trunc('month', mes)::date)
);

create index cuotas_diarias_fecha_idx on public.cuotas_diarias(fecha);
create index cuotas_mensuales_mes_idx on public.cuotas_mensuales(mes);

-- -----------------------------------------------------------------------------
-- 7. Seguridad simple: solo usuarios autenticados.
-- Este núcleo está diseñado para mantener UN único usuario en Supabase Auth.
-- -----------------------------------------------------------------------------
alter table public.app_sql_versions enable row level security;
alter table public.puestos enable row level security;
alter table public.personas enable row level security;
alter table public.productos enable row level security;
alter table public.inventario_movimientos enable row level security;
alter table public.ventas enable row level security;
alter table public.venta_detalles enable row level security;
alter table public.cuotas_diarias enable row level security;
alter table public.cuotas_mensuales enable row level security;

create policy puestos_authenticated_all
on public.puestos for all to authenticated
using (true) with check (true);

create policy personas_authenticated_all
on public.personas for all to authenticated
using (true) with check (true);

create policy productos_authenticated_all
on public.productos for all to authenticated
using (true) with check (true);

create policy inventario_movimientos_authenticated_all
on public.inventario_movimientos for all to authenticated
using (true) with check (true);

create policy ventas_authenticated_all
on public.ventas for all to authenticated
using (true) with check (true);

create policy venta_detalles_authenticated_all
on public.venta_detalles for all to authenticated
using (true) with check (true);

create policy cuotas_diarias_authenticated_all
on public.cuotas_diarias for all to authenticated
using (true) with check (true);

create policy cuotas_mensuales_authenticated_all
on public.cuotas_mensuales for all to authenticated
using (true) with check (true);

revoke all on public.app_sql_versions from anon, authenticated;

grant select, insert, update, delete on public.puestos to authenticated;
grant select, insert, update, delete on public.personas to authenticated;
grant select, insert, update, delete on public.productos to authenticated;
grant select, insert, update, delete on public.inventario_movimientos to authenticated;
grant select, insert, update, delete on public.ventas to authenticated;
grant select, insert, update, delete on public.venta_detalles to authenticated;
grant select, insert, update, delete on public.cuotas_diarias to authenticated;
grant select, insert, update, delete on public.cuotas_mensuales to authenticated;
grant select on public.inventario_stock to authenticated;
grant usage, select on all sequences in schema public to authenticated;

insert into public.app_sql_versions(version, name)
values (1, 'reset_nucleo');

commit;

-- Después de ejecutar:
-- 1) Supabase > Authentication > Users > Add user.
-- 2) Crea UN solo usuario con correo y contraseña.
-- 3) Inicia sesión en AdminGes.
