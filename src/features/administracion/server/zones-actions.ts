"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/features/auth/server/authorization";

export type ZoneActionResult = { ok: boolean; message: string };
const zoneSchema = z.object({
 id: z.string().uuid().nullable(),
 codigo: z.string().trim().min(1).max(30),
 descripcion: z.string().trim().min(1).max(500),
 encargadoPersonaId: z.string().uuid(),
});
const statusSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

function friendlyError(code: string | undefined, message: string): string {
 if (message.includes("ZONE_CODE_DUPLICATE") || message.includes("23505")) return "Ya existe una zona con ese código.";
 if (message.includes("INVALID_ZONE_MANAGER")) return "Selecciona un encargado activo con puesto y autorización Zonal.";
 if (message.includes("ZONE_HAS_ACTIVE_STORES")) return "No puedes eliminar una zona que tiene tiendas activas.";
 if (message.includes("ZONE_MANAGER_REQUIRED")) return "La zona necesita un encargado para reactivarse.";
 if (message.includes("ZONE_NOT_FOUND")) return "La zona ya no existe. Actualiza el listado.";
 if (code === "PGRST202" || message.includes("function public.owner_")) return "SQL 026 ya puede estar aplicado, pero PostgREST no ve la función. Ejecuta NOTIFY pgrst, 'reload schema'; en SQL Editor y vuelve a intentar.";
 if (message.includes("42501") || message.includes("OWNER_REQUIRED")) return "Solo Owner puede administrar zonas.";
 return `No se pudo completar la operación (código ${code ?? "desconocido"}). Aplica SQL 029 o comparte este código con el administrador.`;
}
function refreshZones() {
 revalidatePath("/configuraciones/zonas");
 revalidatePath("/configuraciones/tiendas");
 revalidatePath("/administracion");
}

export async function saveZoneWithManager(input: unknown): Promise<ZoneActionResult> {
 const parsed = zoneSchema.safeParse(input);
 if (!parsed.success) return { ok: false, message: "Completa código, descripción y encargado Zonal." };
 const { supabase } = await requireRole("owner");
 const { error } = await supabase.rpc("owner_save_zone", {
  p_zona_id: parsed.data.id,
  p_codigo: parsed.data.codigo,
  p_descripcion: parsed.data.descripcion,
  p_encargado_persona_id: parsed.data.encargadoPersonaId,
 });
 if (error) return { ok: false, message: friendlyError(error.code, error.message) };
 refreshZones();
 return { ok: true, message: parsed.data.id ? "Zona actualizada correctamente." : "Zona creada correctamente." };
}

export async function setZoneActive(input: unknown): Promise<ZoneActionResult> {
 const parsed = statusSchema.safeParse(input);
 if (!parsed.success) return { ok: false, message: "Zona o estado inválidos." };
 const { supabase } = await requireRole("owner");
 const { error } = await supabase.rpc("owner_set_zone_active", {
  p_zona_id: parsed.data.id,
  p_active: parsed.data.active,
 });
 if (error) return { ok: false, message: friendlyError(error.code, error.message) };
 refreshZones();
 return { ok: true, message: parsed.data.active ? "Zona reactivada." : "Zona desactivada sin perder su historial." };
}
