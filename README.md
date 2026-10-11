# AdminGes

Núcleo simple para gestión comercial.

## Módulos

- **Inventario**
  - Cargar
  - Stock
  - Análisis
- **Ventas**
  - Agregar
  - Historial
  - Análisis
- **Cuotas**
  - Cuotas Diaria
  - Cuota Mensual
  - Seguimiento Mensual
  - Seguimiento Diario
- **Personal**
  - Vista única para listar y agregar personal
- **Herramientas**
  - Specs
  - Gancheras
  - Preciador

No existen roles, zonas, clusters, tiendas ni permisos por alcance en esta etapa.

Supabase Auth mantiene **un solo usuario de acceso**. El personal/promotores vive en `public.personas` y no posee cuenta Auth.

## Stack

- Next.js 16 + TypeScript
- Tailwind CSS
- Supabase Auth + PostgreSQL + RLS
- React Hook Form + Zod
- SweetAlert2
- Font Awesome

## Reset de Supabase

Este nuevo núcleo reemplaza completamente el modelo anterior.

Ejecuta manualmente:

```text
sql/001_reset_nucleo.sql
```

**Advertencia:** el script elimina los datos anteriores de AdminGes y también los usuarios de Supabase Auth.

Después del reset:

1. Ve a **Supabase > Authentication > Users**.
2. Crea un único usuario con correo y contraseña.
3. Configura `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://luazeuykhymxikhrgakf.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

4. Ejecuta:

```bash
npm install
npm run typecheck
npm run dev
```

## Inventario

El inventario usa un libro de movimientos:

- `productos`: catálogo.
- `inventario_movimientos`: entradas/salidas.
- `inventario_stock`: vista que calcula el stock actual.

El stock no se edita directamente. Cada cambio se registra como movimiento, lo que permite mantener trazabilidad y preparar el enlace con Ventas.

## SQL versionado

No usamos Supabase Migrations. A partir de este reset, el nuevo historial comienza en:

```text
001_reset_nucleo.sql
```

Los siguientes cambios usarán `002_...`, `003_...`, etc.
