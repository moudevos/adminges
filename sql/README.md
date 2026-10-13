# SQL versionado — núcleo simple

AdminGes usa SQL manual ejecutado desde **Supabase > SQL Editor**.

Orden actual:

```text
001_reset_nucleo.sql
002_inventario_snapshots_kardex.sql
003_inventario_multiubicacion.sql
004_inventario_stock_filtros_series.sql
005_registro_ventas_jornada.sql
006_ventas_cuotas_equipo_diario.sql
007_cerrar_jornadas_pendientes.sql
008_metodos_pago_configurables.sql
009_ventas_historial_reversa_ultimo_precio.sql
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

## 004

Amplía `inventario_stock` para la vista filtrable:

- expone categoría principal y subcategoría comercial
- expone las series/IMEIs por SKU + ubicación como `text[]`
- permite búsqueda local por nombre, SKU o IMEI sin crear filas duplicadas

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
`005_...`, `006_...`, etc.


## 005

Agrega el flujo operativo de Ventas:

- `jornadas_venta`: una jornada diaria abierta/cerrada
- `jornada_personal`: personal disponible y turno activo
- `venta_pagos`: pagos simples y mixtos
- extiende `ventas` y `venta_detalles` para auditoría de SKU/serie/ubicación
- RPC `open_sales_day`, `set_sales_shift`, `close_sales_day`, `register_sale`
- cada venta genera una salida en `inventario_kardex`
- `inventario_stock` conserva el físico del snapshot y descuenta ventas posteriores para disponibilidad operativa
- la reconciliación evita duplicar como "salida pendiente" una venta ya registrada


## 006

Amplía la apertura diaria de Ventas:

- Personal distingue `puede_vender`, `is_active` y `estado_laboral = activo/vacaciones`
- agrega el puesto `Supervisor`
- la jornada guarda cuota AMT, cuota Láminas y cuota SC+
- la apertura selecciona el equipo disponible, si vende ese día y su hora programada
- un supervisor puede estar disponible y decidirse por día si participa en ventas
- el turno solo puede iniciarse para personal programado, activo y no de vacaciones
- una venta solo puede asignarse a alguien habilitado para vender, marcado `vende_hoy` y con turno activo


## 007

Permite cerrar desde la interfaz cualquier jornada que haya quedado abierta,
incluidas jornadas creadas antes de SQL 006 y que no llegaron a configurarse
con cuotas/equipo.


## 008

Convierte los medios de pago en configuración persistente:

- crea `metodos_pago` con opciones activas/inactivas y orden
- si un método ya tiene ventas, se conserva para mantener el histórico
- `venta_pagos.metodo` referencia el catálogo en vez de una lista fija
- `register_sale` acepta únicamente métodos activos al confirmar una venta
- mantiene los métodos iniciales: Efectivo, Tarjeta, Yape, Plin y Transferencia


## 009

Completa el núcleo auditable de Ventas:

- `ultimo_precio_venta` conserva el último precio de una venta confirmada por producto
- `ventas_historial_resumen` expone un resumen filtrable sin multiplicar detalles/pagos
- `reverse_sale` anula una venta de forma transaccional y escribe la entrada correspondiente en Kardex
- Kardex incorpora el tipo `anulacion_venta`
- el stock operativo reincorpora reversas hechas después del último snapshot
- una venta anulada deja de participar en stock vendido y en el último precio sugerido
