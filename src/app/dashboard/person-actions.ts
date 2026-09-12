"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { contextHasPermission, getAuthorizationContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PersonActionState = {
  ok: boolean;
  message: string;
};

type Role = "admin" | "supervisor" | "promotor";

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);

const optionalPassword = z.preprocess(
  (value) => (typeof value === "string" && value === "" ? undefined : value),
  z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72).optional(),
);

const personSchema = z.object({
  first_name: z.string().trim().min(2, "Ingresa los nombres.").max(80),
  last_name: z.string().trim().min(1, "Ingresa los apellidos.").max(80),
  email: z.string().trim().email("Correo inválido.").max(160),
  role: z.enum(["admin", "supervisor", "promotor"]),
  store_id: optionalUuid,
  document: optionalText(30),
  phone: optionalText(30),
});

const createSchema = personSchema.extend({
  initial_password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72),
});

const updateSchema = personSchema.extend({
  persona_id: z.string().uuid("Persona inválida."),
  user_id: optionalUuid,
  new_password: optionalPassword,
  is_active: z.enum(["true", "false"]),
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisa los datos ingresados.";
}

function permissionForCreate(role: Role) {
  return role === "promotor" ? PERMISSIONS.promotersCreate : PERMISSIONS.usersCreate;
}

function permissionForUpdate(role: Role) {
  return role === "promotor" ? PERMISSIONS.promotersUpdate : PERMISSIONS.usersUpdate;
}

async function canUseStore(
  context: NonNullable<Awaited<ReturnType<typeof getAuthorizationContext>>>,
  storeId: string,
) {
  const { data } = await context.supabase
    .from("stores")
    .select("id")
    .eq("id", storeId)
    .eq("is_active", true)
    .maybeSingle();

  return Boolean(data);
}

function dbErrorMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505") return "Ya existe otra persona con ese documento, correo o usuario.";
  return error?.message ?? "No se pudo guardar la persona.";
}

async function syncSupervisorStore(
  admin: ReturnType<typeof createAdminClient>,
  userId: string,
  role: Role,
  storeId: string | undefined,
  active: boolean,
) {
  await admin.from("store_supervisors").update({ is_active: false }).eq("user_id", userId);

  if (role !== "supervisor" || !storeId) return null;

  const { error } = await admin.from("store_supervisors").upsert(
    { store_id: storeId, user_id: userId, is_active: active },
    { onConflict: "store_id,user_id" },
  );

  return error;
}

export async function createPersonUnified(
  _previousState: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const {
    first_name,
    last_name,
    email,
    role,
    store_id,
    document,
    phone,
    initial_password,
  } = parsed.data;

  if (!contextHasPermission(context, permissionForCreate(role))) {
    return { ok: false, message: "No tienes permiso para crear una persona con ese rol." };
  }

  if (role === "admin" && context.profile.role !== "admin") {
    return { ok: false, message: "Solo un administrador puede crear otro administrador." };
  }

  if ((role === "supervisor" || role === "promotor") && !store_id) {
    return { ok: false, message: "Selecciona una tienda para esta persona." };
  }

  if (store_id && !(await canUseStore(context, store_id))) {
    return { ok: false, message: "No tienes acceso a la tienda seleccionada." };
  }

  const fullName = `${first_name} ${last_name}`.trim();
  const normalizedEmail = email.toLowerCase();
  const admin = createAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: initial_password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (error || !data.user) {
    return { ok: false, message: error?.message ?? "No se pudo crear la cuenta de acceso." };
  }

  const userId = data.user.id;

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      email: normalizedEmail,
      role,
      document: document ?? null,
      phone: phone ?? null,
      is_active: true,
    })
    .eq("id", userId);

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: dbErrorMessage(profileError) };
  }

  const assignmentError = await syncSupervisorStore(admin, userId, role, store_id, true);
  if (assignmentError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: "No se pudo asignar la tienda al supervisor." };
  }

  const { error: personError } = await admin.from("personas").insert({
    user_id: userId,
    store_id: role === "admin" ? null : (store_id ?? null),
    first_name,
    last_name,
    document: document ?? null,
    phone: phone ?? null,
    email: normalizedEmail,
    role,
    is_active: true,
    created_by: context.user.id,
  });

  if (personError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: dbErrorMessage(personError) };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Persona, usuario y rol creados correctamente." };
}

export async function updatePersonUnified(
  _previousState: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const {
    persona_id,
    user_id,
    first_name,
    last_name,
    email,
    role,
    store_id,
    document,
    phone,
    new_password,
    is_active,
  } = parsed.data;

  const admin = createAdminClient();
  const active = is_active === "true";

  const { data: currentPerson } = await admin
    .from("personas")
    .select("id, user_id, role")
    .eq("id", persona_id)
    .maybeSingle();

  if (!currentPerson) return { ok: false, message: "No se encontró la persona." };

  const currentRole: Role =
    currentPerson.role === "admin"
      ? "admin"
      : currentPerson.role === "supervisor"
        ? "supervisor"
        : "promotor";

  if (!contextHasPermission(context, permissionForUpdate(currentRole))) {
    return { ok: false, message: "No tienes permiso para editar esta persona." };
  }

  if (role !== currentRole && !contextHasPermission(context, permissionForUpdate(role))) {
    return { ok: false, message: "No tienes permiso para asignar el nuevo rol." };
  }

  if (role === "admin" && context.profile.role !== "admin") {
    return { ok: false, message: "Solo un administrador puede asignar el rol Administrador." };
  }

  if ((role === "supervisor" || role === "promotor") && !store_id) {
    return { ok: false, message: "Selecciona una tienda para esta persona." };
  }

  if (store_id && !(await canUseStore(context, store_id))) {
    return { ok: false, message: "No tienes acceso a la tienda seleccionada." };
  }

  const currentUserId = currentPerson.user_id ?? user_id;

  if (currentUserId === context.user.id && !active) {
    return { ok: false, message: "No puedes desactivar tu propia cuenta." };
  }

  if (currentUserId === context.user.id && role !== context.profile.role) {
    return { ok: false, message: "No puedes cambiar tu propio rol desde esta pantalla." };
  }

  const fullName = `${first_name} ${last_name}`.trim();
  const normalizedEmail = email.toLowerCase();
  let targetUserId = currentUserId;

  if (!targetUserId) {
    if (!new_password) {
      return { ok: false, message: "Define una contraseña para crear el acceso de esta persona." };
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: new_password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });

    if (error || !data.user) {
      return { ok: false, message: error?.message ?? "No se pudo crear la cuenta de acceso." };
    }

    targetUserId = data.user.id;
  } else {
    const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, {
      email: normalizedEmail,
      ...(new_password ? { password: new_password } : {}),
      user_metadata: { full_name: fullName },
    });

    if (authError) return { ok: false, message: authError.message };
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      email: normalizedEmail,
      role,
      document: document ?? null,
      phone: phone ?? null,
      is_active: active,
    })
    .eq("id", targetUserId);

  if (profileError) return { ok: false, message: dbErrorMessage(profileError) };

  const assignmentError = await syncSupervisorStore(admin, targetUserId, role, store_id, active);
  if (assignmentError) {
    return { ok: false, message: "La persona se actualizó, pero no se pudo asignar la tienda." };
  }

  const { error: personError } = await admin
    .from("personas")
    .update({
      user_id: targetUserId,
      store_id: role === "admin" ? null : (store_id ?? null),
      first_name,
      last_name,
      document: document ?? null,
      phone: phone ?? null,
      email: normalizedEmail,
      role,
      is_active: active,
    })
    .eq("id", persona_id);

  if (personError) return { ok: false, message: dbErrorMessage(personError) };

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: new_password
      ? "Persona actualizada y contraseña reemplazada."
      : "Persona actualizada correctamente.",
  };
}