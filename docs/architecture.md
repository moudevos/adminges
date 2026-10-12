# AdminGes — arquitectura

## Núcleo

AdminGes tiene cinco módulos operativos: Inventario, Ventas, Cuotas, Personal y Herramientas. No se modelan zonas, clusters, roles ni permisos por alcance.

Supabase Auth mantiene un único usuario de acceso. `personas` representa personal comercial y no usuarios Auth.

## Ruteo

El shell autenticado vive en un route group de Next.js:

```text
src/app/(app)/layout.tsx
```

El nombre `(app)` no forma parte de la URL. Cada módulo tiene rutas semánticas reales:

```text
/inventario/cargar
/inventario/stock
/inventario/analisis

/ventas/agregar
/ventas/historial
/ventas/analisis

/cuotas/diaria
/cuotas/mensual
/cuotas/seguimiento-mensual
/cuotas/seguimiento-diario

/personal

/herramientas/specs
/herramientas/gancheras
/herramientas/preciador
```

`/dashboard` existe únicamente como redirect de compatibilidad para enlaces antiguos con `?module=&view=`. No contiene la lógica de los módulos.

El sidebar y el topbar derivan su estado activo del pathname. La URL es la única fuente de verdad para módulo y vista.

## Inventario

El Excel aplicado es el canon del inventario. El sistema conserva snapshots completos y compara el snapshot candidato contra el snapshot vigente antes de aplicar cambios.

`inventario_stock` representa el estado vigente por SKU + ubicación lógica. El stock operativo para venta corresponde a `Cantidad disponible` en `KIOSKO MALL IQUITOS - KIO37 / Stock`.

`inventario_kardex` conserva entradas, salidas y traslados. Para productos serializados también conserva la serie/IMEI asociada al movimiento.

## Datos principales

```text
puestos
  └── personas
        ├── ventas
        ├── cuotas_diarias
        └── cuotas_mensuales

productos
  ├── inventory_snapshot_items
  ├── inventory_serial_registry
  ├── inventario_kardex
  └── venta_detalles

inventory_snapshots
  └── inventory_snapshot_items
```
