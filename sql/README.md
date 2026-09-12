# SQL versionado

AdminGes usa scripts SQL manuales y versionados. No usamos `supabase/migrations`.

## Convención

`NNN_descripcion.sql`

Ejemplos:

- `001_implementacion_auth_perfiles.sql`
- `002_implementacion_tiendas.sql`
- `003_implementacion_promotores.sql`

Cada archivo debe ejecutarse en orden desde **Supabase > SQL Editor** y, cuando corresponda, registrar su versión en `public.app_sql_versions`.

## Comprobar qué scripts se aplicaron

```sql
select version, name, applied_at
from public.app_sql_versions
order by version;
```

No renumerar ni modificar un SQL ya aplicado en producción. Cualquier cambio posterior debe ir en un archivo nuevo.
