# SQL versionado — núcleo simple

AdminGes usa SQL manual ejecutado desde **Supabase > SQL Editor**.

Orden actual:

```text
001_reset_nucleo.sql
002_inventario_snapshots_kardex.sql
003_inventario_multiubicacion.sql
```

## 001

Crea el núcleo base: puestos, personas, productos, ventas, cuotas y la
estructura inicial de inventario.

## 002

Convierte Inventario al modelo canónico por snapshots:

- `inventory_snapshots`
- `inventory_snapshot_items`
- `inventory_serial_registry`
- `inventario_kardex`
- bucket privado `inventory-snapshots`
- RPC transaccional `apply_inventory_snapshot`
- vista `inventario_stock` basada en el último snapshot aplicado

## 003

Habilita correctamente inventario multiubicación:

- un SKU puede coexistir en Stock, Exhibición, Devoluciones y Tránsito
- una serie/IMEI sigue siendo única
- no serializados se concilian por SKU + almacén + ubicación
- cambios de ubicación generan traslados en Kardex
- la vista `inventario_stock` devuelve una fila por SKU + ubicación

El Excel aplicado es el estado canónico. El Kardex es el libro histórico que
explica entradas, salidas y traslados; no se usa como fuente para reconstruir el
stock vigente.

Para consultar versiones:

```sql
select version, name, applied_at
from public.app_sql_versions
order by version;
```

No editar un SQL ya aplicado. Los siguientes cambios deben usar
`004_...`, `005_...`, etc.
