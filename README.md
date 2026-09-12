# AdminGes

Sistema para gestión de tiendas, inventario, ventas, personal, horarios, cuotas y analítica operacional.

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
SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
```

`SUPABASE_SERVICE_ROLE_KEY` se usa únicamente en el servidor para operaciones administrativas de Supabase Auth, como crear usuarios. Nunca debe llevar prefijo `NEXT_PUBLIC_`, mostrarse en el navegador ni subirse al repositorio.

## SQL de Supabase

No usamos Supabase Migrations. Los cambios de base de datos están versionados manualmente en `/sql` y se ejecutan desde **Supabase > SQL Editor**.

Ejecutar siempre en orden:

1. `sql/001_implementacion_auth_perfiles.sql`
2. `sql/002_rbac_tiendas_promotores.sql`
3. `sql/003_personal_promotor_auth.sql`

Para comprobar los scripts aplicados:

```sql
select version, name, applied_at
from public.app_sql_versions
order by version;
```

Regla: un SQL aplicado no se modifica ni renumera; una corrección nueva genera el siguiente archivo `NNN_...sql`.

## Autorización

La seguridad usa varias capas:

1. Supabase Auth valida la sesión.
2. `profiles.role` define el rol base (`admin`, `supervisor` o `promotor`).
3. `role_permissions` define permisos por rol.
4. `user_permissions` permite overrides individuales futuros.
5. Las Server Actions vuelven a validar el permiso antes de escribir.
6. Row Level Security limita el acceso directamente en PostgreSQL.
7. Los supervisores solo acceden a tiendas asignadas mediante `store_supervisors`.
8. Los promotores con login solo acceden a la tienda asociada a su ficha.

Ocultar un módulo en el sidebar no concede ni revoca acceso por sí mismo; la protección real está en servidor y RLS.

## Personal

Usuarios y promotores comparten una sola vista de administración, pero permanecen separados en el modelo de datos:

- `profiles` + Supabase Auth: identidades con acceso al sistema.
- `promoters`: entidad comercial del promotor.
- `promoters.user_id`: vínculo opcional entre un promotor y su cuenta Auth.

Al crear un promotor se puede elegir entre:

- Promotor sin acceso al sistema.
- Promotor con cuenta Auth de rol `promotor`.

Los usuarios internos (`admin` y `supervisor`) se administran desde la misma vista **Personal**, en una pestaña separada.

## Módulos operativos iniciales

- Personal: promotores y usuarios internos.
- Tiendas: listado y creación según permiso.
- Los demás módulos ya tienen permisos definidos y se implementarán sobre esta misma base.

## Scripts del proyecto

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```
