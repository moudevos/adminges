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

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().uuid().optional(),
);

const optionalPassword = z.preprocess(
  (value) => (typeof value === "string" && value === "" ? undefined : value),
  z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72).optional(),
);

const personBaseSchema = z.object({
  first_name: z.string().trim().min(2, "Ingresa los nombres.").max(80),
  last_name: z.string().trim().min(2, "Ingresa los apellidos.").max(80),
  email: z.string().trim().email("Correo de usuario inválido.").max(160),
  role: z.enum(["admin", "supervisor", "promotor"]),
  store_id: optionalUuid,
  document: optionalText(30),
  phone: optionalText(30),
});

const createPersonSchema = personBaseSchema.extend({
  initial_password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72),
});

const updatePersonSchema = personBaseSchema.extend({
  user_id: optionalUuid,
  promoter_id: optionalUuid,
  new_password: optionalPassword,
  is_active: z.enum(["true", "false"]),
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

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisa los datos ingresados.";
}

function roleLabel(role: "admin" | "supervisor" | "promotor") {
  return role === "admin" ? "administrador" : role === "supervisor" ? "supervisor" : "promotor";
}

async function ensureStoreAccess(
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

function canCreateRole(
  context: NonNullable<Awaited<ReturnType<typeof getAuthorizationContext>>>,
  role: "admin" | "supervisor" | "promotor",
) {
  if (role === "promotor") {
    return contextHasPermission(context, PERMISSIONS.promotersCreate);
  }

  return contextHasPermission(context, PERMISSIONS.usersCreate);
}

function canUpdateRole(
  context: NonNullable<Awaited<ReturnType<typeof getAuthorizationContext>>>,
  role: "admin" | "supervisor" | "promotor",
) {
  if (role === "promotor") {
    return contextHasPermission(context, PERMISSIONS.promotersUpdate);
  }

  return contextHasPermission(context, PERMISSIONS.usersUpdate);
}

export async function createPerson(
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };

  const parsed = createPersonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const {
    first_name,
    last_name,
    email,
    initial_password,
    role,
    store_id,
    document,
    phone,
  } = parsed.data;

  if (!canCreateRole(context, role)) {
    return { ok: false, message: `No tienes permiso para crear una persona con rol ${roleLabel(role)}.` };
  }

  if (role === "admin" && context.profile.role !== "admin") {
    return { ok: false, message: "Solo un administrador puede crear otra cuenta administradora." };
  }

  if ((role === "supervisor" || role === "promotor") && !store_id) {
    return { ok: false, message: "Selecciona la tienda que se asignará a esta persona." };
  }

  if (store_id && !(await ensureStoreAccess(context, store_id))) {
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
      is_active: true,
    })
    .eq("id", userId);

  if (profileError) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: "No se pudo configurar el perfil de la persona." };
  }

  if (role === "supervisor") {
    const { error: assignmentError } = await admin.from("store_supervisors").upsert(
      {
        store_id,
        user_id: userId,
        is_active: true,
      },
      { onConflict: "store_id,user_id" },
    );

    if (assignmentError) {
      await admin.auth.admin.deleteUser(userId);
      return { ok: false, message: "No se pudo asignar la tienda al supervisor." };
    }
  }

  if (role === "promotor") {
    const { error: promoterError } = await admin.from("promoters").insert({
      user_id: userId,
      store_id,
      first_name,
      last_name,
      document: document ?? null,
      phone: phone ?? null,
      email: normalizedEmail,
      created_by: context.user.id,
      is_active: true,
    });

    if (promoterError) {
      await admin.auth.admin.deleteUser(userId);
      return {
        ok: false,
        message:
          promoterError.code === "23505"
            ? "Ya existe una persona con ese documento o usuario."
            : "No se pudo crear la ficha comercial del promotor.",
      };
    }
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Persona, usuario y rol creados correctamente." };
}

export async function updatePerson(
  _previousState: ManagementActionState,
  formData: FormData,
): Promise<ManagementActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };

  const parsed = updatePersonSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const {
    user_id,
    promoter_id,
    first_name,
    last_name,
    email,
    new_password,
    role,
    store_id,
    document,
    phone,
    is_active,
  } = parsed.data;

  const active = is_active === "true";
  const admin = createAdminClient();
  let currentRole: "admin" | "supervisor" | "promotor" | null = null;

  if (user_id) {
    const { data: currentProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user_id)
      .maybeSingle();

    if (!currentProfile) {
      return { ok: false, message: "No se encontró el usuario asociado a esta persona." };
    }

    currentRole =
      currentProfile.role === "admin"
        ? "admin"
        : currentProfile.role === "promotor"
          ? "promotor"
          : "supervisor";

    const canEditCurrent =
      currentRole === "promotor"
        ? contextHasPermission(context, PERMISSIONS.promotersUpdate)
        : contextHasPermission(context, PERMISSIONS.usersUpdate);

    if (!canEditCurrent) {
      return { ok: false, message: "No tienes permiso para editar esta persona." };
    }
  } else if (!contextHasPermission(context, PERMISSIONS.promotersUpdate)) {
    return { ok: false, message: "No tienes permiso para editar este promotor." };
  }

  if (role !== currentRole && !canUpdateRole(context, role)) {
    return { ok: false, message: `No tienes permiso para asignar el rol ${roleLabel(role)}.` };
  }

  if (role === "admin" && context.profile.role !== "admin") {
    return { ok: false, message: "Solo un administrador puede asignar el rol administrador." };
  }

  if ((role === "supervisor" || role === "promotor") && !store_id) {
    return { ok: false, message: "Selecciona la tienda asignada a esta persona." };
  }

  if (store_id && !(await ensureStoreAccess(context, store_id))) {
    return { ok: false, message: "No tienes acceso a la tienda seleccionada." };
  }

  if (user_id === context.user.id && !active) {
    return { ok: false, message: "No puedes desactivar tu propia cuenta." };
  }

  if (user_id === context.user.id && role !== context.profile.role) {
    return { ok: false, message: "No puedes cambiar tu propio rol desde esta pantalla." };
  }

  const fullName = `${first_name} ${last_name}`.trim();
  const normalizedEmail = email.toLowerCase();
  let targetUserId = user_id;

  if (!targetUserId) {
    if (!new_password) {
      return {
        ok: false,
        message: "Esta persona todavía no tiene usuario. Define una contraseña para crear su acceso.",
      };
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

    if (authError) {
      return { ok: false, message: authError.message };
    }
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      email: normalizedEmail,
      role,
      is_active: active,
    })
    .eq("id", targetUserId);

  if (profileError) {
    return { ok: false, message: "No se pudo actualizar el perfil de la persona." };
  }

  await admin
    .from("store_supervisors")
    .update({ is_active: false })
    .eq("user_id", targetUserId);

  if (role === "supervisor" && store_id) {
    const { error: assignmentError } = await admin.from("store_supervisors").upsert(
      {
        store_id,
        user_id: targetUserId,
        is_active: active,
      },
      { onConflict: "store_id,user_id" },
    );

    if (assignmentError) {
      return { ok: false, message: "El usuario se actualizó, pero no se pudo asignar la tienda." };
    }
  }

  let targetPromoterId = promoter_id;

  if (!targetPromoterId) {
    const { data: linkedPromoter } = await admin
      .from("promoters")
      .select("id")
      .eq("user_id", targetUserId)
      .maybeSingle();
    targetPromoterId = linkedPromoter?.id;
  }

  if (role === "promotor") {
    const promoterPayload = {
      user_id: targetUserId,
      store_id,
      first_name,
      last_name,
      document: document ?? null,
      phone: phone ?? null,
      email: normalizedEmail,
      is_active: active,
    };

    if (targetPromoterId) {
      const { error: promoterError } = await admin
        .from("promoters")
        .update(promoterPayload)
        .eq("id", targetPromoterId);

      if (promoterError) {
        return { ok: false, message: "No se pudo actualizar la ficha comercial del promotor." };
      }
    } else {
      const { error: promoterError } = await admin.from("promoters").insert({
        ...promoterPayload,
        created_by: context.user.id,
      });

      if (promoterError) {
        return { ok: false, message: "No se pudo crear la ficha comercial del promotor." };
      }
    }
  } else if (targetPromoterId) {
    await admin.from("promoters").update({ is_active: false }).eq("id", targetPromoterId);
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: new_password
      ? "Persona actualizada y contraseña reemplazada."
      : "Persona actualizada correctamente.",
  };
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
