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

`SUPABASE_SERVICE_ROLE_KEY` se usa únicamente en el servidor para operaciones administrativas de Supabase Auth. Nunca debe llevar prefijo `NEXT_PUBLIC_`, mostrarse en el navegador ni subirse al repositorio.

## SQL de Supabase

No usamos Supabase Migrations. Los cambios de base de datos están versionados manualmente en `/sql` y se ejecutan desde **Supabase > SQL Editor**.

Ejecutar siempre en orden:

1. `sql/001_implementacion_auth_perfiles.sql`
2. `sql/002_rbac_tiendas_promotores.sql`
3. `sql/003_personal_promotor_auth.sql`
4. `sql/004_datos_personales_comunes.sql`
5. `sql/005_personas_entidad_central.sql`

Los nombres históricos de los SQL anteriores no se cambian porque los scripts aplicados son inmutables.

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
2. `profiles.role` mantiene el rol de autorización (`admin`, `supervisor` o `promotor`).
3. `role_permissions` define permisos por rol.
4. `user_permissions` permite overrides individuales futuros.
5. Las Server Actions vuelven a validar el permiso antes de escribir.
6. Row Level Security limita el acceso directamente en PostgreSQL.
7. Los supervisores solo acceden a tiendas asignadas mediante `store_supervisors`.
8. Los promotores solo acceden a la tienda asociada a su Persona.

Ocultar un módulo en el sidebar no concede ni revoca acceso por sí mismo; la protección real está en servidor y RLS.

## Personas

La entidad de dominio principal para cualquier integrante es `public.personas`.

Contiene:

- nombres y apellidos
- documento
- teléfono
- correo/usuario
- rol
- tienda principal cuando aplica
- estado
- vínculo opcional a Supabase Auth mediante `user_id`

`profiles` ya no representa a la persona de negocio. Su función es soportar la cuenta autenticada y el RBAC. Durante esta etapa conserva algunos campos duplicados por compatibilidad con los SQL anteriores, pero la fuente canónica para Personal es `personas`.

El SQL `005` renombra la antigua tabla `promoters` a `personas` y agrega automáticamente a los Admin/Supervisor existentes para evitar pérdida de datos.

Crear o editar una persona se realiza desde un modal único. La contraseña actual nunca se puede consultar; solo puede ser reemplazada.

## Módulos operativos iniciales

- Personal: CRUD unificado sobre `personas` y credenciales Auth.
- Tiendas: listado y creación según permiso.
- Los demás módulos ya tienen permisos definidos y se implementarán sobre esta misma base.

## Scripts del proyecto

```bash
npm run dev
npm run lint
npm run typecheck
npm run build
```
