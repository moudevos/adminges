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

El Excel diario es el canon del inventario. Cada carga genera un snapshot candidato, se valida contra el snapshot vigente y solo después de confirmación pasa a ser el estado actual.

- `inventory_snapshots`: historial de snapshots.
- `inventory_snapshot_items`: detalle normalizado por SKU, serie y ubicación.
- `inventory_serial_registry`: registro histórico de IMEI/series.
- `inventario_kardex`: entradas, salidas y traslados.
- `inventario_stock`: vista del último snapshot aplicado.

## SQL versionado

No usamos Supabase Migrations. A partir de este reset, el nuevo historial comienza en:

```text
001_reset_nucleo.sql
```

Los siguientes cambios usarán `002_...`, `003_...`, etc.


## Rutas

La aplicación usa rutas semánticas por módulo. Ejemplos:

```text
/inventario/stock
/inventario/cargar
/ventas/historial
/cuotas/seguimiento-diario
/personal
/herramientas/specs
```

`/dashboard` se conserva únicamente como redirect de compatibilidad para enlaces antiguos.
