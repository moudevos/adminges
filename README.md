# AdminGes

Sistema para gestión de tiendas, inventario, ventas, promotores, horarios, cuotas y analítica operacional.

## Stack

- Next.js + TypeScript
- Tailwind CSS
- Supabase Auth/PostgreSQL
- SweetAlert2
- Font Awesome
- React Hook Form + Zod
- TanStack Table
- Recharts
- Vercel

## Requisitos

- Node.js 22+
- npm 10+
- Proyecto Supabase

## Desarrollo local

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configura `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://luazeuykhymxikhrgakf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Nunca publiques `service_role` ni secretos privados con prefijo `NEXT_PUBLIC_`.

## SQL de Supabase

No usamos Supabase Migrations. Los cambios de base de datos están versionados manualmente en `/sql`.

Ejecutar en orden desde **Supabase > SQL Editor**:

1. `sql/001_implementacion_auth_perfiles.sql`

Para comprobar los scripts aplicados:

```sql
select version, name, applied_at
from public.app_sql_versions
order by version;
```

Regla: un SQL aplicado no se modifica ni renumera; una corrección nueva genera el siguiente archivo `NNN_...sql`.

## Rutas iniciales

- `/login`: pública.
- `/dashboard`: requiere sesión Supabase válida.
- `/`: entrada protegida; redirige al dashboard.

## Scripts del proyecto

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```
