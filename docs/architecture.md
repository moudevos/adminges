# AdminGes — arquitectura

## Principio

AdminGes se organiza por **rutas** y por **features**. App Router decide la URL y los layouts; cada feature contiene sus componentes, dominio y lógica de servidor.

## Rutas

```text
src/app/
├── (auth)/
│   └── login/
├── (app)/
│   ├── layout.tsx
│   ├── inventario/
│   │   ├── cargar/
│   │   ├── stock/
│   │   └── analisis/
│   ├── ventas/
│   ├── cuotas/
│   ├── personal/
│   └── herramientas/
├── api/
│   └── inventario/
│       └── snapshots/
└── dashboard/
    └── page.tsx
```

Los route groups `(auth)` y `(app)` no aparecen en la URL. `/dashboard` existe únicamente como redirect legacy.

## Features

```text
src/features/
├── auth/
│   ├── components/
│   └── server/
├── inventario/
│   ├── components/
│   ├── domain/
│   └── server/
├── personal/
│   ├── components/
│   └── server/
├── ventas/
│   └── components/
├── cuotas/
│   └── components/
└── herramientas/
    └── components/
```

Regla: una página de `src/app` debe ser delgada. No concentra lógica de negocio; importa la vista y el loader/acción desde su feature.

## Compartido

```text
src/components/
├── shell/   # sidebar, topbar, app shell
└── ui/      # primitivas reutilizables

src/config/
└── navigation.ts

src/lib/
└── supabase/ # clientes SSR/browser/proxy
```

## Inventario

El Excel diario es el canon. Los archivos se normalizan en `features/inventario/domain`, se procesan en `features/inventario/server` y se exponen por `/api/inventario/snapshots/*`.

El snapshot aplicado representa el estado vigente. `inventario_kardex` explica entradas, salidas y traslados. La vista `inventario_stock` expone el estado por SKU + ubicación lógica.

## Autenticación

Supabase Auth mantiene un único usuario de acceso. Las acciones de login/logout viven en `features/auth/server/actions.ts`. Personal comercial vive en `public.personas` y no representa usuarios Auth.


### Movimientos

`/inventario/movimientos` consulta el Kardex por SKU o por IMEI/serie. La búsqueda se ejecuta en servidor. Por SKU consolida movimientos por fecha + tipo + origen/destino y suma sus cantidades; por IMEI devuelve cada evento individual de la vida de esa unidad. Entradas suman, salidas restan y traslados tienen impacto neto cero. En Stock, cada fila puede abrir las series esperadas del snapshot vigente para ese SKU + ubicación.


## Ventas y jornada diaria

Ventas opera con una única jornada por fecha.

La apertura guarda:

- cuota AMT monetaria
- cuota de Láminas en unidades
- cuota SC+ monetaria
- personal disponible ese día
- hora programada de ingreso entre 09:00 y 19:00
- si cada integrante participa en ventas ese día

Personal mantiene dos controles distintos: `is_active` indica si la persona
sigue habilitada en la organización y `estado_laboral` permite marcar
vacaciones temporalmente. `puede_vender` define capacidad de venta. La
participación efectiva se decide por día con `jornada_personal.vende_hoy`.

Las cuotas individuales no se cargan manualmente: se reparten entre los
integrantes con `vende_hoy = true`. Un supervisor puede formar parte del
equipo sin vender, o participar en el reparto cuando se lo marca como vendedor
del día.

Las barras de avance usan:

- AMT: importe total vendido
- Láminas: unidades cuya clasificación de producto contiene LAMINA
- SC+: importe de productos identificados como SC+, SC Plus o Samsung Care
