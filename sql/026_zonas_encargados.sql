-- AdminGes: Zonas (Codigo, Descripcion, Encargado Zonal).
-- Aplicar manualmente en Supabase SQL Editor DESPUES de 025.
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM public.app_sql_versions WHERE version=25) THEN RAISE EXCEPTION 'SQL_025_REQUIRED'; END IF;
 IF EXISTS (SELECT 1 FROM public.app_sql_versions WHERE version=26) THEN RAISE EXCEPTION 'SQL_026_ALREADY_APPLIED'; END IF;
END $$;

-- Las asignaciones son de personas, incluso antes del autorregistro.
ALTER TABLE public.zona_zonales
 ADD COLUMN IF NOT EXISTS persona_id uuid REFERENCES public.personas(id) ON DELETE RESTRICT,
 ADD COLUMN IF NOT EXISTS ended_at timestamptz;
UPDATE public.zona_zonales zz SET persona_id=up.persona_id
FROM public.user_profiles up
WHERE zz.user_id=up.user_id AND zz.persona_id IS NULL;
ALTER TABLE public.zona_zonales ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.zona_zonales ADD CONSTRAINT zona_zonales_identidad_check
 CHECK (persona_id IS NOT NULL OR user_id IS NOT NULL);
CREATE INDEX IF NOT EXISTS zona_zonales_persona_idx
 ON public.zona_zonales(persona_id, valid_from DESC);
CREATE UNIQUE INDEX IF NOT EXISTS zonas_codigo_normalizado_unique
 ON public.zonas ((upper(btrim(codigo))));
-- Impedir mutaciones directas que omitan encargado e historial.
REVOKE INSERT,UPDATE,DELETE ON public.zonas,public.zona_zonales FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.zonas,public.zona_zonales,public.access_authorizations TO authenticated;
CREATE POLICY zona_zonales_owner_select ON public.zona_zonales
 FOR SELECT TO authenticated USING ((SELECT public.is_owner()));

CREATE FUNCTION public.owner_save_zone(
 p_zona_id uuid, p_codigo text, p_descripcion text, p_encargado_persona_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE
 v_id uuid;
 v_previous jsonb;
 v_current_id uuid;
 v_current_persona uuid;
 v_new_user uuid;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 p_codigo := upper(btrim(coalesce(p_codigo,'')));
 p_descripcion := btrim(coalesce(p_descripcion,''));
 IF length(p_codigo)=0 OR length(p_codigo)>30 THEN RAISE EXCEPTION 'INVALID_ZONE_CODE'; END IF;
 IF length(p_descripcion)=0 OR length(p_descripcion)>500 THEN RAISE EXCEPTION 'INVALID_ZONE_DESCRIPTION'; END IF;
 IF p_encargado_persona_id IS NULL OR NOT EXISTS (
   SELECT 1 FROM public.personas p JOIN public.puestos pu ON pu.id=p.puesto_id
   WHERE p.id=p_encargado_persona_id AND p.is_active
    AND lower(btrim(pu.nombre))='zonal'
    AND (
      EXISTS (SELECT 1 FROM public.access_authorizations a
        WHERE a.persona_id=p.id AND a.role='zonal' AND a.is_active AND a.revoked_at IS NULL)
      OR EXISTS (SELECT 1 FROM public.user_profiles u
        WHERE u.persona_id=p.id AND u.role='zonal' AND u.is_active)
    )
 ) THEN RAISE EXCEPTION 'INVALID_ZONE_MANAGER'; END IF;

 IF p_zona_id IS NULL THEN
   INSERT INTO public.zonas(codigo,nombre,descripcion,is_active)
   VALUES(p_codigo,p_descripcion,p_descripcion,true) RETURNING id INTO v_id;
 ELSE
   SELECT to_jsonb(z) INTO v_previous FROM public.zonas z
   WHERE z.id=p_zona_id FOR UPDATE;
   IF v_previous IS NULL THEN RAISE EXCEPTION 'ZONE_NOT_FOUND'; END IF;
   UPDATE public.zonas
   SET codigo=p_codigo,nombre=p_descripcion,descripcion=p_descripcion,updated_at=now()
   WHERE id=p_zona_id RETURNING id INTO v_id;
 END IF;

 SELECT zz.id,coalesce(zz.persona_id,up.persona_id)
 INTO v_current_id,v_current_persona
 FROM public.zona_zonales zz
 LEFT JOIN public.user_profiles up ON up.user_id=zz.user_id
 WHERE zz.zona_id=v_id AND zz.valid_to IS NULL
 FOR UPDATE OF zz;

 SELECT up.user_id INTO v_new_user FROM public.user_profiles up
 WHERE up.persona_id=p_encargado_persona_id AND up.role='zonal' AND up.is_active LIMIT 1;

 IF v_current_id IS NULL OR v_current_persona IS DISTINCT FROM p_encargado_persona_id THEN
   -- El cierre durante el mismo dia conserva hora exacta en ended_at.
   UPDATE public.zona_zonales
   SET valid_to=greatest(valid_from,current_date),ended_at=clock_timestamp()
   WHERE zona_id=v_id AND valid_to IS NULL;
   INSERT INTO public.zona_zonales(zona_id,persona_id,user_id,valid_from)
   VALUES(v_id,p_encargado_persona_id,v_new_user,current_date);
 ELSIF v_new_user IS NOT NULL THEN
   UPDATE public.zona_zonales SET user_id=v_new_user,persona_id=p_encargado_persona_id
   WHERE id=v_current_id AND (user_id IS DISTINCT FROM v_new_user OR persona_id IS NULL);
 END IF;

 INSERT INTO public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data)
 VALUES(auth.uid(),CASE WHEN p_zona_id IS NULL THEN 'create' ELSE 'update' END,
  'zona',v_id,v_previous,jsonb_build_object('codigo',p_codigo,
  'descripcion',p_descripcion,'encargado_persona_id',p_encargado_persona_id));
 RETURN v_id;
EXCEPTION WHEN unique_violation THEN
 RAISE EXCEPTION 'ZONE_CODE_DUPLICATE';
END;
$fn$;

CREATE FUNCTION public.owner_set_zone_active(p_zona_id uuid,p_active boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $fn$
DECLARE v_before jsonb;
BEGIN
 IF NOT public.is_owner() THEN RAISE EXCEPTION 'OWNER_REQUIRED' USING ERRCODE='42501'; END IF;
 IF p_active IS NULL THEN RAISE EXCEPTION 'INVALID_ZONE_STATUS'; END IF;
 SELECT to_jsonb(z) INTO v_before FROM public.zonas z WHERE z.id=p_zona_id FOR UPDATE;
 IF v_before IS NULL THEN RAISE EXCEPTION 'ZONE_NOT_FOUND'; END IF;
 IF NOT p_active AND EXISTS (
  SELECT 1 FROM public.tiendas t WHERE t.zona_id=p_zona_id AND t.is_active
 ) THEN RAISE EXCEPTION 'ZONE_HAS_ACTIVE_STORES'; END IF;
 IF p_active AND NOT EXISTS (
  SELECT 1 FROM public.zona_zonales zz WHERE zz.zona_id=p_zona_id AND zz.valid_to IS NULL
 ) THEN RAISE EXCEPTION 'ZONE_MANAGER_REQUIRED'; END IF;
 UPDATE public.zonas SET is_active=p_active,updated_at=now() WHERE id=p_zona_id;
 INSERT INTO public.admin_audit_log(actor_id,action,entity_type,entity_id,before_data,after_data)
 VALUES(auth.uid(),CASE WHEN p_active THEN 'reactivate' ELSE 'deactivate' END,
  'zona',p_zona_id,v_before,jsonb_build_object('is_active',p_active));
END;
$fn$;

REVOKE ALL ON FUNCTION public.owner_save_zone(uuid,text,text,uuid) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.owner_set_zone_active(uuid,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.owner_save_zone(uuid,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_set_zone_active(uuid,boolean) TO authenticated;

INSERT INTO public.app_sql_versions(version,name) VALUES(26,'zonas_encargados');
COMMIT;
