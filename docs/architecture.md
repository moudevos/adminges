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
2. Tiendas.
3. Inventario y movimientos.
4. Ventas y detalle de venta.
5. Promotores.
6. Horarios.
7. Cuotas mensuales/diarias y sesión diaria.
8. KPIs y motor analítico.

## Regla de seguridad

La interfaz nunca determina permisos. El frontend solo presenta capacidades; PostgreSQL RLS y lógica server-side deben imponer el acceso real.

## Próximo modelo de datos

- stores
- store_members
- promoters
- products
- inventory_movements
- sales
- sale_items
- schedules
- monthly_quotas
- daily_quotas
- daily_sessions
- kpi_snapshots

No se crean todavía para evitar fijar prematuramente reglas del negocio antes de definir el flujo operativo de cada módulo.
