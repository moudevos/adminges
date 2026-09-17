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

`SUPABASE_SERVICE_ROLE_KEY` se usa únicamente en el servidor para operaciones administrativas de Supabase Auth y seguridad. Nunca debe llevar prefijo `NEXT_PUBLIC_`, mostrarse en el navegador ni subirse al repositorio.

## SQL de Supabase

No usamos Supabase Migrations. Los cambios de base de datos están versionados manualmente en `/sql` y se ejecutan desde **Supabase > SQL Editor**.

Ejecutar siempre en orden:

1. `sql/001_implementacion_auth_perfiles.sql`
2. `sql/002_rbac_tiendas_promotores.sql`
3. `sql/003_personal_promotor_auth.sql`
4. `sql/004_datos_personales_comunes.sql`
5. `sql/005_personas_entidad_central.sql`
6. `sql/006_estructura_organizacional_alcance.sql`
7. `sql/007_seguridad_sesiones_rate_limit.sql`
8. `sql/008_endurecimiento_sesion.sql`

Los nombres históricos de los SQL anteriores no se cambian porque los scripts aplicados son inmutables.

Para comprobar los scripts aplicados:

```sql
select version, name, applied_at
from public.app_sql_versions
order by version;
```

Regla: un SQL aplicado no se modifica ni renumera; una corrección nueva genera el siguiente archivo `NNN_...sql`.

## Persona, puesto, rol y alcance

La entidad de dominio principal es `public.personas`.

- **Persona**: quién es el integrante.
- **Puesto**: función organizacional (`Administrador`, `Zonal`, `Supervisor`, `Promotor`, y futuros puestos).
- **Cuenta/Auth**: identidad con la que inicia sesión.
- **Rol**: permisos del sistema.
- **Alcance**: sobre qué tiendas puede operar.

`profiles` soporta la cuenta autenticada y RBAC. `personas.user_id` vincula la Persona con Supabase Auth/Profile.

El puesto y el rol son conceptos distintos. Actualmente existen roles base:

- `admin`
- `zonal`
- `supervisor`
- `promotor`

## Jerarquía territorial

La estructura es:

```text
Zona
└── Cluster
    └── Tiendas
```

Una Zona representa un conjunto amplio de tiendas. Un Cluster agrupa un subconjunto de tiendas de una zona.

El alcance se guarda explícitamente:

- `persona_zones`: Zonal → Zona.
- `persona_clusters`: Supervisor Cluster → Cluster.
- `persona_stores`: Supervisor KIO/SES o Promotor → Tienda(s) directas.

No se determina `Supervisor Cluster` únicamente por cantidad. Si tiene asignación en `persona_clusters`, es Supervisor Cluster. Si tiene tiendas directas en `persona_stores`, se identifica como Supervisor KIO/SES. La cantidad de tiendas es un dato derivado, no la fuente de verdad.

La función `public.can_access_store(store_id)` centraliza el alcance. Ventas, inventario, cuotas, horarios y demás módulos con `store_id` deben reutilizar esta función en sus RLS.

## Autorización

La seguridad usa varias capas:

1. Supabase Auth valida la sesión.
2. `profiles.role` mantiene el rol de autorización.
3. `role_permissions` define permisos por rol.
4. `user_permissions` permite overrides individuales.
5. Las Server Actions validan permisos y jerarquía antes de escribir.
6. Row Level Security limita los datos directamente en PostgreSQL.
7. `can_access_store()` limita el alcance territorial.
8. `app_sessions` permite revocar una sesión dentro de AdminGes.

Ocultar un módulo en el sidebar no concede ni revoca acceso. La protección efectiva está en servidor y PostgreSQL.

## Sesiones renovables y revocables

El Proxy de Next.js usa `supabase.auth.getClaims()` para verificar el JWT y permitir que `@supabase/ssr` renueve access/refresh tokens mediante cookies.

Cada sesión se registra en `public.app_sessions` usando el `session_id` del JWT. Se guarda:

- usuario/persona
- IP
- user-agent
- fecha de inicio
- último uso
- fecha y motivo de revocación

Una sesión marcada como revocada deja de obtener permisos y alcance inmediatamente en AdminGes, aunque un access token emitido anteriormente todavía no haya alcanzado su `exp`.

El menú **Seguridad** permite consultar y revocar sesiones cuando el rol tiene `sessions.read` / `sessions.revoke`.

El cierre de sesión normal usa scope `local`, por lo que cierra el dispositivo/sesión actual sin forzar el cierre de otros dispositivos.

## Rate limit de login

El login se ejecuta mediante Server Action, no directamente desde el navegador.

AdminGes aplica un límite adicional al nativo de Supabase:

- 5 fallos por correo + IP: bloqueo de 15 minutos.
- 8 fallos: 30 minutos.
- 10 fallos: 60 minutos.
- 20 fallos desde una IP en 15 minutos: bloqueo de IP durante 30 minutos.

Los intentos se registran en `login_attempts` y se conservan 90 días. Los mensajes de error no confirman si una cuenta existe.

Supabase Auth mantiene además sus propios límites sobre `/auth/v1/token`; ambos controles son complementarios.

## Módulos operativos iniciales

- Personal: Persona + puesto + rol + credenciales + alcance.
- Tiendas: listado y creación según permiso.
- Territorio: Zonas, Clusters y ubicación de tiendas.
- Seguridad: sesiones activas/revocadas.
- Los demás módulos continúan sobre la misma base de permisos y alcance.

## Validación del proyecto

```bash
npm run typecheck
npm run lint
npm run build
```

También existe `.github/workflows/ci.yml` para ejecutar estas validaciones en GitHub Actions cuando el repositorio tenga Actions habilitado.
