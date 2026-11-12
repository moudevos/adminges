"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { requireRole } from "@/features/auth/server/authorization";

export type AdminActionState = { ok: boolean; message: string };
const id = z.string().uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.preprocess(v => typeof v === "string" && !v.trim() ? null : v, z.string().trim().max(max).nullable());
const result = (error: { message: string } | null, success: string): AdminActionState => error ? { ok: false, message: error.message } : { ok: true, message: success };
async function owner() { return requireRole("owner"); }
function refresh(...paths: string[]) { paths.forEach((path) => revalidatePath(path)); }

export async function savePuesto(input: unknown): Promise<AdminActionState> {
  const parsed = z.object({ id: id.optional(), nombre: text(120), descripcion: optional(500), is_active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos de puesto inválidos." };
  const { supabase } = await owner(); const { id: puestoId, ...values } = parsed.data;
  const { error } = puestoId ? await supabase.from("puestos").update({ ...values, updated_at: new Date().toISOString() }).eq("id", puestoId) : await supabase.from("puestos").insert(values);
  refresh("/configuraciones/puestos", "/personal"); return result(error, puestoId ? "Puesto actualizado." : "Puesto creado.");
}

export async function saveZona(input: unknown): Promise<AdminActionState> {
  const parsed = z.object({ id: id.optional(), codigo: text(30), nombre: text(120), descripcion: optional(500), is_active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos de zona inválidos." };
  const { supabase } = await owner(); const { id: zonaId, ...values } = parsed.data;
  const { error } = zonaId ? await supabase.from("zonas").update({ ...values, updated_at: new Date().toISOString() }).eq("id", zonaId) : await supabase.from("zonas").insert(values);
  refresh("/configuraciones/zonas", "/administracion"); return result(error, zonaId ? "Zona actualizada." : "Zona creada.");
}

export async function saveTienda(input: unknown): Promise<AdminActionState> {
  const parsed = z.object({ id: id.optional(), codigo: text(30), nombre: text(120), direccion: optional(250), email: z.preprocess(v => typeof v === "string" && !v.trim() ? null : v, z.string().email().max(160).nullable()), zona_id: id, latitude: z.coerce.number().min(-90).max(90).nullable(), longitude: z.coerce.number().min(-180).max(180).nullable(), radio_metros: z.coerce.number().positive().max(10000).nullable().default(50), categoria:z.enum(["Oro","Plata","Bronce"]), tipo:z.enum(["SES","KIOSKO"]), supervisor_id:id.nullable().optional(), promotores:z.array(id).default([]), is_active: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Datos de tienda inválidos." };
  const { supabase } = await owner(); const values=parsed.data;
  const { error } = await supabase.rpc("save_store_with_team", { p_tienda_id:values.id ?? null,p_codigo:values.codigo,p_nombre:values.nombre,p_direccion:values.direccion,p_email:values.email,p_zona_id:values.zona_id,p_latitude:values.latitude,p_longitude:values.longitude,p_radio_metros:values.radio_metros,p_categoria:values.categoria,p_tipo:values.tipo,p_is_active:values.is_active,p_supervisor_id:values.supervisor_id ?? null,p_promotores:values.promotores });
  refresh("/configuraciones/tiendas", "/administracion"); return result(error, values.id ? "Tienda actualizada." : "Tienda creada.");
}

export async function assign(input: unknown): Promise<AdminActionState> {
  const parsed = z.object({ kind: z.enum(["zonal", "supervisor", "promotor"]), targetId: id, personId: id, effectiveDate: z.string().date().optional(), motivo: optional(300) }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Asignación inválida." };
  const auth = await owner(); const { kind, targetId, personId, effectiveDate, motivo } = parsed.data;
  const date = effectiveDate ?? new Date().toISOString().slice(0, 10);
  const rpc = kind === "zonal" ? "assign_zonal_to_zone" : kind === "supervisor" ? "assign_supervisor_to_store" : "assign_promoter_to_store";
  const args = kind === "zonal" ? { p_zona_id: targetId, p_user_id: personId, p_effective_date: date } : kind === "supervisor" ? { p_tienda_id: targetId, p_user_id: personId, p_effective_date: date } : { p_tienda_id: targetId, p_persona_id: personId, p_effective_date: date, p_motivo: motivo };
  const { error } = await auth.supabase.rpc(rpc, args);
  refresh("/asignaciones", "/configuraciones/zonas", "/configuraciones/tiendas", "/personal"); return result(error, "Asignación guardada con historial.");
}

export async function changeUserStatus(input: unknown): Promise<AdminActionState> {
  const parsed = z.object({ userId: id, isActive: z.boolean() }).safeParse(input); if (!parsed.success) return { ok:false, message:"Usuario inválido." };
  const { supabase, userId } = await owner();
  if (parsed.data.userId === userId) return { ok:false, message:"No puedes cambiar tu propio acceso." };
  if (!parsed.data.isActive) { const { count } = await supabase.from("user_profiles").select("*", { count:"exact", head:true }).eq("role","owner").eq("is_active",true); const { data: target } = await supabase.from("user_profiles").select("role").eq("user_id",parsed.data.userId).maybeSingle(); if (target?.role === "owner" && (count ?? 0) <= 1) return { ok:false, message:"No se puede desactivar al último Owner activo." }; }
  const { error } = await supabase.from("user_profiles").update({ is_active:parsed.data.isActive }).eq("user_id",parsed.data.userId);
  refresh("/configuraciones/usuarios", "/administracion"); return result(error, "Estado de acceso actualizado.");
}

export async function inviteUser(input: unknown): Promise<AdminActionState> {
  const parsed = z.object({ personaId: id, email: z.string().trim().email().max(160), role: z.enum(["owner", "zonal", "supervisor"]) }).safeParse(input);
  if (!parsed.success) return { ok:false, message:"Datos de invitación inválidos." };
  const { supabase, userId } = await owner();
  if (parsed.data.role === "owner") return { ok:false, message:"La asignación de Owner debe realizarse por otro Owner mediante el procedimiento controlado." };
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) return { ok:false, message:"Falta SUPABASE_SERVICE_ROLE_KEY en el servidor; no se creó ningún usuario." };
  const { data: existing } = await supabase.from("user_profiles").select("user_id").eq("persona_id", parsed.data.personaId).maybeSingle();
  if (existing) return { ok:false, message:"La persona ya tiene una cuenta vinculada." };
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, { auth:{ autoRefreshToken:false, persistSession:false } });
  const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo: process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL}/login` : undefined });
  if (error || !data.user) return { ok:false, message:error?.message ?? "No se pudo enviar la invitación." };
  const { error: profileError } = await supabase.from("user_profiles").insert({ user_id:data.user.id, persona_id:parsed.data.personaId, role:parsed.data.role, is_active:true, created_by:userId });
  if (profileError) { await admin.auth.admin.deleteUser(data.user.id); return { ok:false, message:"No se vinculó la cuenta; la invitación fue revertida." }; }
  refresh("/configuraciones/usuarios", "/administracion"); return { ok:true, message:"Invitación enviada y usuario vinculado." };
}
