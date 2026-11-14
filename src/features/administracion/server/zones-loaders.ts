import "server-only";
import { requireRole } from "@/features/auth/server/authorization";

export type ZoneOption = { id: string; nombre: string; documento: string | null };
export type ZoneListItem = {
 id: string; codigo: string; descripcion: string;
 encargadoPersonaId: string | null; encargadoNombre: string | null; isActive: boolean;
};
export type ZonesManagementData = {
 zones: ZoneListItem[]; managers: ZoneOption[]; migrationReady: boolean; error: string | null;
};

export async function loadZonesManagementData(): Promise<ZonesManagementData> {
 const { supabase } = await requireRole("owner");
 const [zonesResult, relationResult, peopleResult, authorizationsResult, profilesResult, migration] =
  await Promise.all([
   supabase.from("zonas").select("id,codigo,nombre,descripcion,is_active").order("codigo"),
   supabase.from("zona_zonales").select("id,zona_id,persona_id,user_id,valid_to"),
   supabase.from("personas").select("id,nombres,apellidos,documento,is_active,puestos(nombre)"),
   supabase.from("access_authorizations").select("persona_id,role,is_active,revoked_at"),
   supabase.from("user_profiles").select("user_id,persona_id,role,is_active"),
   supabase.from("zona_zonales").select("persona_id").limit(1),
  ]);

 const firstError = [zonesResult, relationResult, peopleResult, authorizationsResult, profilesResult]
  .find((result) => result.error)?.error;
 if (firstError) {
  return {
   zones: [], managers: [], migrationReady: !migration.error,
   error: migration.error
    ? "La gestión de encargados requiere aplicar SQL 026 después de 025."
    : "No se pudo cargar Zonas. Verifica las migraciones y permisos de Owner.",
  };
 }

 const profiles = profilesResult.data ?? [];
 const people = peopleResult.data ?? [];
 const userToPerson = new Map(profiles.map((profile) => [profile.user_id, profile.persona_id]));
 const authorized = new Set<string>();
 for (const item of authorizationsResult.data ?? []) {
  if (item.role === "zonal" && item.is_active && !item.revoked_at) authorized.add(item.persona_id);
 }
 for (const item of profiles) {
  if (item.role === "zonal" && item.is_active) authorized.add(item.persona_id);
 }

 const peopleMap = new Map(people.map((person) => [person.id, person]));
 const managerByZone = new Map<string, string | null>();
 for (const relation of relationResult.data ?? []) {
  if (relation.valid_to !== null) continue;
  managerByZone.set(relation.zona_id, relation.persona_id ?? (relation.user_id ? userToPerson.get(relation.user_id) : null) ?? null);
 }

 const managers: ZoneOption[] = people
  .filter((person) => {
   const position = Array.isArray(person.puestos) ? person.puestos[0] : person.puestos;
   return person.is_active && position?.nombre?.trim().toLowerCase() === "zonal" && authorized.has(person.id);
  })
  .map((person) => ({
   id: person.id,
   nombre: [person.nombres, person.apellidos].join(" ").trim(),
   documento: person.documento ? "••••" + person.documento.slice(-4) : null,
  }))
  .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));

 const zones: ZoneListItem[] = (zonesResult.data ?? []).map((zone) => {
  const encargadoPersonaId = managerByZone.get(zone.id) ?? null;
  const person = encargadoPersonaId ? peopleMap.get(encargadoPersonaId) : null;
  return {
   id: zone.id, codigo: zone.codigo,
   descripcion: zone.descripcion?.trim() || zone.nombre,
   encargadoPersonaId,
   encargadoNombre: person ? [person.nombres, person.apellidos].join(" ").trim() : null,
   isActive: zone.is_active,
  };
 });

 return {
  zones, managers,
  migrationReady: !migration.error,
  error: migration.error ? "Aplica SQL 026 para habilitar la asignación de encargados sin cuenta Auth." : null,
 };
}
