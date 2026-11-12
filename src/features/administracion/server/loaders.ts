import "server-only";
import { requireRole } from "@/features/auth/server/authorization";
export async function adminData() {
 const { supabase } = await requireRole("owner");
 const [puestos, zonas, tiendas, personas, profiles, zonales, supervisors, promoters] = await Promise.all([
  supabase.from("puestos").select("id,nombre,descripcion,is_active").order("nombre"), supabase.from("zonas").select("id,codigo,nombre,descripcion,is_active").order("nombre"), supabase.from("tiendas").select("id,codigo,nombre,direccion,email,zona_id,latitude,longitude,radio_metros,categoria,tipo,version,is_active,zonas(nombre)").order("nombre"), supabase.from("personas").select("id,nombres,apellidos,documento,email,puesto_id,is_active,puestos(nombre)").order("apellidos"), supabase.from("user_profiles").select("user_id,persona_id,role,is_active,created_at,personas(nombres,apellidos,email,puestos(nombre))").order("created_at",{ascending:false}), supabase.from("zona_zonales").select("id,zona_id,user_id,valid_from,valid_to"), supabase.from("tienda_supervisores").select("id,tienda_id,user_id,valid_from,valid_to"), supabase.from("tienda_promotores").select("id,tienda_id,persona_id,valid_from,valid_to,motivo")
 ]);
 return { puestos: puestos.data ?? [], zonas: zonas.data ?? [], tiendas: tiendas.data ?? [], personas: personas.data ?? [], profiles: profiles.data ?? [], zonales: zonales.data ?? [], supervisors: supervisors.data ?? [], promoters: promoters.data ?? [] };
}
