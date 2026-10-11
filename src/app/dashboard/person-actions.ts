"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type PersonActionState = {
  ok: boolean;
  message: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const schema = z.object({
  puesto_id: z.string().uuid(),
  nombres: z.string().trim().min(2).max(120),
  apellidos: z.string().trim().min(2).max(120),
  documento: optionalText(30),
  telefono: optionalText(30),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email().max(160).optional(),
  ),
});

export async function createPerson(
  _previous: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const parsed = schema.safeParse({
    puesto_id: formData.get("puesto_id"),
    nombres: formData.get("nombres"),
    apellidos: formData.get("apellidos"),
    documento: formData.get("documento"),
    telefono: formData.get("telefono"),
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();
  if (authError || !claims?.claims?.sub) {
    return { ok: false, message: "La sesión expiró." };
  }

  const { error } = await supabase.from("personas").insert({
    puesto_id: parsed.data.puesto_id,
    nombres: parsed.data.nombres,
    apellidos: parsed.data.apellidos,
    documento: parsed.data.documento ?? null,
    telefono: parsed.data.telefono ?? null,
    email: parsed.data.email ?? null,
  });

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "El documento ya existe." : "No se pudo crear la persona.",
    };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Persona agregada correctamente." };
}
