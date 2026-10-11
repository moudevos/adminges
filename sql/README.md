# SQL versionado — núcleo simple

AdminGes usa SQL manual ejecutado desde **Supabase > SQL Editor**.

El modelo anterior fue retirado intencionalmente. El nuevo historial comienza desde cero con:

```text
001_reset_nucleo.sql
```

Este script elimina el modelo anterior y los usuarios Auth de AdminGes, y crea el núcleo de:

- puestos
- personas
- productos
- movimientos de inventario
- ventas y detalle
- cuotas diarias
- cuotas mensuales

Después del reset, crea manualmente un único usuario en **Authentication > Users**.

Para consultar la versión aplicada:

```sql
select version, name, applied_at
from public.app_sql_versions
order by version;
```

Los siguientes cambios deben usar `002_...`, `003_...`, etc.
