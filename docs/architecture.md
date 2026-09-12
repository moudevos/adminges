# AdminGes — arquitectura inicial

## Stack

- Next.js 16 (App Router + Proxy)
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase Auth + PostgreSQL + RLS
- @supabase/ssr para sesiones cookie-based
- React Hook Form + Zod
- SweetAlert2
- Font Awesome
- TanStack Table
- Recharts
- Vercel

## Capas

1. Autenticación y autorización.
2. Personas y asignaciones.
3. Tiendas.
4. Inventario y movimientos.
5. Ventas y detalle de venta.
6. Horarios.
7. Cuotas mensuales/diarias y sesión diaria.
8. KPIs y motor analítico.

## Regla de seguridad

La interfaz nunca determina permisos. El frontend solo presenta capacidades; PostgreSQL RLS y lógica server-side deben imponer el acceso real.

## Entidades principales

- `personas`: entidad humana central para Admin, Supervisor y Promotor.
- `profiles`: soporte de autenticación/RBAC para usuarios con acceso.
- `stores`: tiendas.
- `store_supervisors`: alcance de tiendas para supervisores.
- `products`: productos.
- `inventory_movements`: movimientos de inventario.
- `sales` / `sale_items`: ventas y detalle.
- `schedules`: horarios.
- `monthly_quotas` / `daily_quotas`: cuotas.
- `daily_sessions`: seguimiento diario.
- `kpi_snapshots`: históricos analíticos.

`personas.user_id` enlaza una Persona con Supabase Auth cuando posee acceso al sistema. El rol de autorización se refleja en `profiles.role`, pero los datos de negocio pertenecen a `personas`.
