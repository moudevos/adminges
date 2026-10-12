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
