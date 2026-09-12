"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { contextHasPermission, getAuthorizationContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ManagementActionState = {
  ok: boolean;
  message: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const createUserSchema = z.object({
  full_name: z.string().trim().min(3, "Ingresa el nombre completo.").max(120),
  email: z.string().trim().email("Correo inválido.").max(160),
  initial_password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72),
  role: z.enum(["admin", "supervisor"]),
  store_id: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
});

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

const createPromoterSchema = z.object({
  store_id: z.string().uuid("Selecciona una tienda válida."),
  first_name: z.string().trim().min(2, "Ingresa los nombres.").max(80),
  last_name: z.string().trim().min(2, "Ingresa los apellidos.").max(80),
  document: optionalText(30),
  phone: optionalText(30),
  email: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().email("Correo inválido.").max(160).optional(),
  ),
  initial_password: z.preprocess(
    (value) => (typeof value === "string" && value === "" ? undefined : value),
    z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72).optional(),
  ),
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisa los datos ingresados.";
}

export async function createAppUser(
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };
  if (!contextHasPermission(context, PERMISSIONS.usersCreate)) {
    return { ok: false, message: "No tienes permiso para crear usuarios internos." };
  }

  const parsed = createUserSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const { full_name, email, initial_password, role, store_id } = parsed.data;

  if (role === "admin" && context.profile.role !== "admin") {
    return { ok: false, message: "Solo un administrador puede crear otra cuenta administradora." };
  }

  if (store_id && !contextHasPermission(context, PERMISSIONS.storesAssign)) {
    return { ok: false, message: "No tienes permiso para asignar usuarios a tiendas." };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: email.toLowerCase(),
    password: initial_password,
    email_confirm: true,
    user_metadata: { full_name },
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "No se pudo crear el usuario." };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({ full_name, email: email.toLowerCase(), role, is_active: true })
    .eq("id", data.user.id);

  if (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    return { ok: false, message: "No se pudo configurar el perfil del usuario." };
  }

  if (role === "supervisor" && store_id) {
    const { error: assignmentError } = await admin.from("store_supervisors").upsert(
      {
        store_id,
        user_id: data.user.id,
        is_active: true,
      },
      { onConflict: "store_id,user_id" },
    );

    if (assignmentError) {
      return {
        ok: true,
        message: "Usuario creado, pero la asignación de tienda no pudo completarse.",
      };
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Usuario interno creado correctamente." };
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

export async function createPromoter(
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };
  if (!contextHasPermission(context, PERMISSIONS.promotersCreate)) {
    return { ok: false, message: "No tienes permiso para crear promotores." };
  }

  const parsed = createPromoterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const createLogin = formData.get("create_login") === "true";
  const { store_id, first_name, last_name, document, phone, email, initial_password } = parsed.data;

  if (createLogin && !email) {
    return { ok: false, message: "El correo es obligatorio cuando creas acceso al sistema." };
  }

  if (createLogin && !initial_password) {
    return { ok: false, message: "Define una contraseña inicial de al menos 8 caracteres." };
  }

  let authUserId: string | null = null;
  const fullName = `${first_name} ${last_name}`.trim();

  if (createLogin) {
    const admin = createAdminClient();
    const { data, error } = await admin.auth.admin.createUser({
      email: email!.toLowerCase(),
      password: initial_password!,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      return {
        ok: false,
        message: error?.message ?? "No se pudo crear la cuenta de acceso del promotor.",
      };
    }

    authUserId = data.user.id;

    const { error: profileError } = await admin
      .from("profiles")
      .update({
        full_name: fullName,
        email: email!.toLowerCase(),
        role: "promotor",
        is_active: true,
      })
      .eq("id", authUserId);

    if (profileError) {
      await admin.auth.admin.deleteUser(authUserId);
      return { ok: false, message: "No se pudo configurar el acceso del promotor." };
    }
  }

  const { error } = await context.supabase.from("promoters").insert({
    user_id: authUserId,
    store_id,
    first_name,
    last_name,
    document: document ?? null,
    phone: phone ?? null,
    email: email?.toLowerCase() ?? null,
    created_by: context.user.id,
  });

  if (error) {
    if (authUserId) {
      const admin = createAdminClient();
      await admin.auth.admin.deleteUser(authUserId);
    }

    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Ya existe un promotor con ese documento o cuenta asociada."
          : error.message,
    };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: createLogin
      ? "Promotor y cuenta de acceso creados correctamente."
      : "Promotor creado correctamente.",
  };
}
