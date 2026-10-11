# AdminGes — núcleo simple

## Principio

La aplicación se reduce a cinco módulos operativos:

1. Inventario
2. Ventas
3. Cuotas
4. Personal
5. Herramientas

No se modelan zonas, clusters, tiendas, roles ni permisos por alcance.

## Autenticación

Supabase Auth tiene un solo usuario de acceso.

`personas` no representa usuarios del sistema. Representa al personal comercial. Las ventas y cuotas se enlazan a estas personas.

## Datos

```text
puestos
  └── personas
        ├── ventas
        ├── cuotas_diarias
        └── cuotas_mensuales

productos
  ├── inventario_movimientos
  └── venta_detalles
```

## Inventario

El stock se deriva de movimientos. No existe una columna editable de stock.

```text
Carga / Ajuste entrada / Anulación venta  → suma
Ajuste salida / Venta                    → resta
```

La vista `inventario_stock` consolida el saldo por producto.

## Siguiente etapa

Primero se estabiliza Inventario. Después se implementan Ventas, Cuotas y Herramientas sobre este núcleo.
