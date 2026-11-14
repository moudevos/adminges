import "server-only";
import { requireRole } from "@/features/auth/server/authorization";
export async function adminData() {
 const { supabase } = await requireRole("owner");
 const [puestos, zonas, tiendas, personas, profiles, zonales, supervisors, promoters, snapshot] = await Promise.all([
  supabase.from("puestos").select("id,nombre,descripcion,is_active").order("nombre"), supabase.from("zonas").select("id,codigo,nombre,descripcion,is_active").order("nombre"), supabase.from("tiendas").select("id,codigo,nombre,direccion,email,zona_id,latitude,longitude,radio_metros,categoria,tipo,version,is_active,zonas(nombre)").order("nombre"), supabase.from("personas").select("id,nombres,apellidos,documento,email,puesto_id,is_active,puestos(nombre)").order("apellidos"), supabase.from("user_profiles").select("user_id,persona_id,role,is_active,created_at,personas(nombres,apellidos,email,puestos(nombre))").order("created_at",{ascending:false}), supabase.from("zona_zonales").select("id,zona_id,user_id,valid_from,valid_to"), supabase.from("tienda_supervisores").select("id,tienda_id,user_id,persona_id,valid_from,valid_to"), supabase.from("tienda_promotores").select("id,tienda_id,persona_id,valid_from,valid_to,motivo"), supabase.rpc("owner_active_assignments_snapshot")
 ]);
 const legacySupervisors = supervisors.error ? await supabase.from("tienda_supervisores").select("id,tienda_id,user_id,valid_from,valid_to") : null;
 const activeAssignments = (snapshot.data ?? []) as { kind: string; entity_id: string; persona_id: string }[];
 const snapshotsReady = !snapshot.error;
 return {
  puestos: puestos.data ?? [], zonas: zonas.data ?? [], tiendas: tiendas.data ?? [], personas: personas.data ?? [], profiles: profiles.data ?? [],
  zonales: snapshotsReady ? activeAssignments.filter((item) => item.kind === "zone_manager").map((item) => ({ zona_id: item.entity_id, persona_id: item.persona_id, valid_to: null })) : zonales.data ?? [],
  supervisors: snapshotsReady ? activeAssignments.filter((item) => item.kind === "store_supervisor").map((item) => ({ tienda_id: item.entity_id, persona_id: item.persona_id, valid_to: null, valid_from: "" })) : supervisors.data ?? legacySupervisors?.data ?? [],
  promoters: snapshotsReady ? activeAssignments.filter((item) => item.kind === "store_promoter").map((item) => ({ tienda_id: item.entity_id, persona_id: item.persona_id, valid_to: null, valid_from: "" })) : promoters.data ?? [],
 };
}
