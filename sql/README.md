# SQL versionado

AdminGes usa scripts SQL manuales y versionados. No usamos `supabase/migrations`.

## Convención

`NNN_descripcion.sql`

Cada archivo se ejecuta en orden desde **Supabase > SQL Editor** y registra su versión en `public.app_sql_versions` cuando termina correctamente.

Estado actual:

```text
001_implementacion_auth_perfiles.sql
002_rbac_tiendas_promotores.sql
003_personal_promotor_auth.sql
004_datos_personales_comunes.sql
005_personas_entidad_central.sql
006_estructura_organizacional_alcance.sql
007_seguridad_sesiones_rate_limit.sql
008_endurecimiento_sesion.sql
009_sesion_auth_rls_restrictivo.sql
010_visibilidad_territorial.sql
011_endurecimiento_catalogos.sql
```

Los nombres de scripts históricos se conservan aunque el modelo haya evolucionado; un SQL aplicado es inmutable.

## Comprobar qué scripts se aplicaron

```sql
select version, name, applied_at
from public.app_sql_versions
order by version;
```

No renumerar ni modificar un SQL ya aplicado. Cualquier cambio posterior debe ir en el siguiente archivo versionado.
