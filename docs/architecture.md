# AdminGes — arquitectura actual

## Stack

- Next.js 16 (App Router + Proxy)
- React 19 + TypeScript
- Tailwind CSS 4
- Supabase Auth + PostgreSQL + RLS
- `@supabase/ssr` para sesiones cookie-based y renovación de tokens
- React Hook Form + Zod
- SweetAlert2
- Font Awesome
- TanStack Table
- Recharts
- Vercel

## Modelo organizacional

La jerarquía conceptual es:

```text
Persona
├── Puesto
├── Cuenta Auth
│   └── Rol -> Permisos
└── Alcance territorial
    ├── Zona
    ├── Cluster
    └── Tienda(s)
```

`Persona`, `Puesto`, `Rol` y `Alcance` son conceptos distintos.

- `personas`: entidad humana central.
- `puestos`: función organizacional.
- `profiles`: identidad de autorización asociada a Supabase Auth.
- `system_roles`: catálogo de roles del sistema.
- `role_permissions`: permisos base del rol.
- `user_permissions`: overrides individuales.

## Jerarquía territorial

```text
Zona
└── Cluster
    └── Tienda
```

Asignaciones:

- `persona_zones`: alcance de Zonal.
- `persona_clusters`: alcance de Supervisor Cluster.
- `persona_stores`: alcance directo de Supervisor KIO/SES y Promotor.

La clasificación de Supervisor no depende únicamente del número de tiendas. Una asignación de cluster significa `Supervisor Cluster`; una asignación directa de tiendas significa `Supervisor KIO/SES`.

`public.can_access_store(store_id)` es la función canónica de alcance y debe reutilizarse en RLS de ventas, inventario, cuotas, horarios y cualquier entidad relacionada con una tienda.

## Seguridad y sesiones

Capas:

1. Supabase Auth autentica al usuario.
2. Next.js Proxy valida/renueva el JWT con `getClaims()`.
3. `app_sessions` registra el `session_id` del JWT, IP, user-agent y último uso.
4. Una sesión puede revocarse desde AdminGes.
5. `current_permissions()` y `can_access_store()` rechazan sesiones revocadas.
6. Server Actions validan permisos y jerarquía antes de escribir.
7. PostgreSQL RLS aplica la última barrera de acceso.

El login pasa por una Server Action con rate limit adicional por correo + IP. Supabase Auth conserva además sus límites nativos.

## Módulos

1. Autenticación y seguridad.
2. Personas, puestos y asignaciones.
3. Territorio: zonas, clusters y tiendas.
4. Inventario y movimientos.
5. Ventas y detalle de venta.
6. Horarios.
7. Cuotas mensuales/diarias y sesión diaria.
8. KPIs y motor analítico.

## Entidades previstas de operación

- `products`
- `inventory_movements`
- `sales`
- `sale_items`
- `schedules`
- `monthly_quotas`
- `daily_quotas`
- `daily_sessions`
- `kpi_snapshots`

Estas entidades deberán llevar `store_id` cuando corresponda para heredar el alcance territorial mediante RLS.
