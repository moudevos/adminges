-- Ejecutar manualmente después de 019. Biometría no se habilita con este script.
begin;
do $$ begin if not exists(select 1 from public.app_sql_versions where version=19) then raise exception 'Apply 019 first'; end if; if exists(select 1 from public.app_sql_versions where version=20) then raise exception 'SQL 020 already applied'; end if; end $$;
create table public.attendance_events (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), tienda_id uuid not null references public.tiendas(id), occurred_at timestamptz not null default now(), event_type text not null check(event_type in ('entrada','inicio_refrigerio','fin_refrigerio','salida')), status text not null default 'confirmed', idempotency_key uuid not null unique, latitude numeric(9,6), longitude numeric(9,6), accuracy_meters numeric(8,2), store_name text not null, created_at timestamptz not null default now());
alter table public.attendance_events enable row level security;
create policy attendance_own_events on public.attendance_events for select to authenticated using (user_id=(select auth.uid()) or (select public.is_owner()));
create table public.attendance_attempts (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id), tienda_id uuid not null references public.tiendas(id), idempotency_key uuid not null unique, created_at timestamptz not null default now(), expires_at timestamptz not null default now()+interval '15 minutes', status text not null default 'pending');
alter table public.attendance_attempts enable row level security;
insert into public.app_sql_versions(version,name) values(20,'asistencia_estructura');
commit;
