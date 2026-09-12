"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { contextHasPermission, getAuthorizationContext } from "@/lib/auth/server";

export type ManagementActionState = {
  ok: boolean;
  message: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const createStoreSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2, "Ingresa un código.")
    .max(20)
    .regex(/^[A-Za-z0-9_-]+$/, "Usa solo letras, números, guion o guion bajo."),
  name: z.string().trim().min(2, "Ingresa el nombre de la tienda.").max(120),
  city: optionalText(80),
  address: optionalText(200),
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisa los datos ingresados.";
}

export async function createStore(
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };

  if (!contextHasPermission(context, PERMISSIONS.storesCreate)) {
    return { ok: false, message: "No tienes permiso para crear tiendas." };
  }

  const parsed = createStoreSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const { code, name, city, address } = parsed.data;
  const { error } = await context.supabase.from("stores").insert({
    code: code.toUpperCase(),
    name,
    city: city ?? null,
    address: address ?? null,
    created_by: context.user.id,
  });

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "Ya existe una tienda con ese código." : error.message,
    };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Tienda creada correctamente." };
}