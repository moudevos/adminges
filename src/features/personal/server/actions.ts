"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/features/auth/server/authorization";

export type PersonActionState = {
  ok: boolean;
  message: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().max(max).optional(),
  );

const createSchema = z.object({
  puesto_id: z.string().uuid(),
  nombres: z.string().trim().min(2).max(120),
  apellidos: z.string().trim().min(2).max(120),
  documento: optionalText(30),
  telefono: optionalText(30),
  email: z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().email().max(160).optional(),
  ),
  puede_vender: z.boolean(),
  estado_laboral: z.enum(["activo", "vacaciones"]),
  role: z.enum(["zonal", "supervisor"]).nullable().optional(),
});

const stateSchema = z.object({
  personId: z.string().uuid(),
  puedeVender: z.boolean(),
  estadoLaboral: z.enum(["activo", "vacaciones"]),
  isActive: z.boolean(),
});

async function authenticatedClient() {
  try { return (await requireRole("owner")).supabase; } catch { return null; }
}

export async function createPerson(
  _previous: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const parsed = createSchema.safeParse({
    puesto_id: formData.get("puesto_id"),
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    documento: formData.get("documento"),
    telefono: formData.get("telefono"),
    email: formData.get("email"),
    puede_vender: formData.get("puede_vender") === "on",
    estado_laboral: formData.get("estado_laboral") || "activo", role: formData.get("role") || null,
  });

  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  }

  const supabase = await authenticatedClient();

  if (!supabase) {
    return { ok: false, message: "La sesión expiró." };
  }

  const { error } = await supabase.rpc("owner_save_person", {p_persona_id:null,p_puesto_id:parsed.data.puesto_id,p_nombres:parsed.data.nombres,p_apellidos:parsed.data.apellidos,p_documento:parsed.data.documento ?? "",p_telefono:parsed.data.telefono ?? "",p_email:parsed.data.email ?? "",p_puede_vender:parsed.data.puede_vender,p_estado_laboral:parsed.data.estado_laboral,p_is_active:true,p_role:parsed.data.role ?? null});

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "El documento ya existe."
          : "No se pudo crear la persona.",
    };
  }

  revalidatePath("/personal");
  revalidatePath("/ventas/dia");
  return { ok: true, message: "Persona agregada correctamente." };
}

export async function updatePersonOperationalState(input: {
  personId: string;
  puedeVender: boolean;
  estadoLaboral: "activo" | "vacaciones";
  isActive: boolean;
}): Promise<PersonActionState> {
  const parsed = stateSchema.safeParse(input);

  if (!parsed.success) {
    return { ok: false, message: "Estado inválido." };
  }

  const supabase = await authenticatedClient();

  if (!supabase) {
    return { ok: false, message: "La sesión expiró." };
  }

  const { error } = await supabase
    .from("personas")
    .update({
      puede_vender: parsed.data.puedeVender,
      estado_laboral: parsed.data.estadoLaboral,
      is_active: parsed.data.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.personId);

  if (error) {
    return { ok: false, message: "No se pudo actualizar el estado." };
  }

  revalidatePath("/personal");
  revalidatePath("/ventas/dia");
  return { ok: true, message: "Estado actualizado correctamente." };
}

const updateSchema = createSchema.extend({ personId: z.string().uuid(), is_active: z.boolean() });
export async function updatePerson(input: unknown): Promise<PersonActionState> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { ok:false, message:"Datos de persona inválidos." };
  const supabase = await authenticatedClient(); if (!supabase) return {ok:false,message:"Solo Owner puede modificar personal."};
  const { personId, ...data } = parsed.data;
  const { error } = await supabase.rpc("owner_save_person", {p_persona_id:personId,p_puesto_id:data.puesto_id,p_nombres:data.nombres,p_apellidos:data.apellidos,p_documento:data.documento ?? "",p_telefono:data.telefono ?? "",p_email:data.email ?? "",p_puede_vender:data.puede_vender,p_estado_laboral:data.estado_laboral,p_is_active:data.is_active,p_role:data.role ?? null});
  if (error) return {ok:false,message:error.code === "23505" ? "El documento o correo ya existe." : "No se pudo actualizar la persona."};
  revalidatePath("/personal"); return {ok:true,message:"Persona actualizada."};
}
