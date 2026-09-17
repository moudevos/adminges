"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import {
  contextHasPermission,
  getAuthorizationContext,
  type AppRole,
} from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PersonActionState = {
  ok: boolean;
  message: string;
};

type ScopeType = "global" | "zone" | "cluster" | "stores" | "store";
type AdminClient = ReturnType<typeof createAdminClient>;

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
  role: z.enum(["admin", "zonal", "supervisor", "promotor"]),
  puesto_id: z.string().uuid("Selecciona un puesto válido."),
  scope_type: z.enum(["global", "zone", "cluster", "stores", "store"]),
  zone_id: optionalUuid,
  cluster_id: optionalUuid,
  document: optionalText(30),
  phone: optionalText(30),
});

const createSchema = personSchema.extend({
  initial_password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres.").max(72),
});

const updateSchema = personSchema.extend({
  persona_id: z.string().uuid(),
  user_id: optionalUuid,
  new_password: optionalPassword,
  is_active: z.enum(["true", "false"]),
});

function validationMessage(error: z.ZodError) {
  return error.issues[0]?.message ?? "Revisa los datos ingresados.";
}

function parseStoreIds(formData: FormData) {
  return formData
    .getAll("store_ids")
    .map((value) => String(value).trim())
    .filter(Boolean);
}

function canManageRole(actorRole: AppRole, targetRole: AppRole) {
  if (actorRole === "admin") return true;
  if (actorRole === "zonal") return targetRole === "supervisor" || targetRole === "promotor";
  if (actorRole === "supervisor") return targetRole === "promotor";
  return false;
}

function expectedScope(role: AppRole, scope: ScopeType) {
  if (role === "admin") return scope === "global";
  if (role === "zonal") return scope === "zone";
  if (role === "supervisor") return scope === "cluster" || scope === "stores";
  return scope === "store";
}

async function validatePosition(
  context: NonNullable<Awaited<ReturnType<typeof getAuthorizationContext>>>,
  puestoId: string,
  targetRole: AppRole,
) {
  const { data } = await context.supabase
    .from("puestos")
    .select("id, code")
    .eq("id", puestoId)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) return false;
  if (context.profile.role === "admin") return true;

  const expectedCode = targetRole === "promotor" ? "promotor" : "supervisor";
  return data.code === expectedCode;
}

async function validateTerritorialScope(
  context: NonNullable<Awaited<ReturnType<typeof getAuthorizationContext>>>,
  role: AppRole,
  scopeType: ScopeType,
  zoneId: string | undefined,
  clusterId: string | undefined,
  storeIds: string[],
) {
  if (!expectedScope(role, scopeType)) {
    return "El tipo de alcance no corresponde al rol seleccionado.";
  }

  if (role === "admin") return null;

  if (role === "zonal") {
    if (!zoneId) return "Selecciona una zona para el Zonal.";
    const { data } = await context.supabase
      .from("zones")
      .select("id")
      .eq("id", zoneId)
      .eq("is_active", true)
      .maybeSingle();
    return data ? null : "No tienes acceso a la zona seleccionada.";
  }

  if (scopeType === "cluster") {
    if (!clusterId) return "Selecciona un cluster para el Supervisor.";
    const { data } = await context.supabase
      .from("clusters")
      .select("id")
      .eq("id", clusterId)
      .eq("is_active", true)
      .maybeSingle();
    return data ? null : "No tienes acceso al cluster seleccionado.";
  }

  const requiredStores = role === "promotor" ? 1 : 1;
  if (storeIds.length < requiredStores) return "Selecciona al menos una tienda.";
  if (role === "promotor" && storeIds.length !== 1) {
    return "Un Promotor debe tener una tienda directa en esta etapa.";
  }

  const { data } = await context.supabase
    .from("stores")
    .select("id")
    .in("id", storeIds)
    .eq("is_active", true);

  return (data?.length ?? 0) === new Set(storeIds).size
    ? null
    : "Una o más tiendas están fuera de tu alcance.";
}

async function clearScope(admin: AdminClient, personaId: string) {
  const results = await Promise.all([
    admin.from("persona_zones").delete().eq("persona_id", personaId),
    admin.from("persona_clusters").delete().eq("persona_id", personaId),
    admin.from("persona_stores").delete().eq("persona_id", personaId),
  ]);

  return results.find((result) => result.error)?.error ?? null;
}

async function syncScope(
  admin: AdminClient,
  personaId: string,
  role: AppRole,
  scopeType: ScopeType,
  zoneId: string | undefined,
  clusterId: string | undefined,
  storeIds: string[],
  actorUserId: string,
) {
  const clearError = await clearScope(admin, personaId);
  if (clearError) return clearError;

  if (role === "admin") return null;

  if (role === "zonal" && zoneId) {
    const { error } = await admin.from("persona_zones").insert({
      persona_id: personaId,
      zone_id: zoneId,
      is_active: true,
      created_by: actorUserId,
    });
    return error;
  }

  if (scopeType === "cluster" && clusterId) {
    const { error } = await admin.from("persona_clusters").insert({
      persona_id: personaId,
      cluster_id: clusterId,
      is_active: true,
      created_by: actorUserId,
    });
    return error;
  }

  if (storeIds.length > 0) {
    const { error } = await admin.from("persona_stores").insert(
      storeIds.map((storeId) => ({
        persona_id: personaId,
        store_id: storeId,
        is_active: true,
        created_by: actorUserId,
      })),
    );
    return error;
  }

  return null;
}

function dbMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505") return "Ya existe una persona con ese documento, correo o vínculo.";
  return error?.message ?? "No se pudo guardar la persona.";
}

export async function createPersonUnified(
  _previousState: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };
  if (!contextHasPermission(context, PERMISSIONS.peopleCreate)) {
    return { ok: false, message: "No tienes permiso para crear personas." };
  }

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const storeIds = parseStoreIds(formData);
  const {
    first_name,
    last_name,
    email,
    role,
    puesto_id,
    scope_type,
    zone_id,
    cluster_id,
    document,
    phone,
    initial_password,
  } = parsed.data;

  if (!canManageRole(context.profile.role, role)) {
    return { ok: false, message: "No puedes crear una persona con ese nivel de acceso." };
  }

  if (!(await validatePosition(context, puesto_id, role))) {
    return { ok: false, message: "El puesto seleccionado no está permitido para esta operación." };
  }

  const scopeError = await validateTerritorialScope(
    context,
    role,
    scope_type,
    zone_id,
    cluster_id,
    storeIds,
  );
  if (scopeError) return { ok: false, message: scopeError };

  const fullName = `${first_name} ${last_name}`.trim();
  const normalizedEmail = email.toLowerCase();
  const admin = createAdminClient();

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: normalizedEmail,
    password: initial_password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (authError || !authData.user) {
    return { ok: false, message: authError?.message ?? "No se pudo crear la cuenta de acceso." };
  }

  const userId = authData.user.id;

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
    return { ok: false, message: dbMessage(profileError) };
  }

  const legacyStoreId = scope_type === "store" || scope_type === "stores" ? storeIds[0] ?? null : null;
  const { data: persona, error: personaError } = await admin
    .from("personas")
    .insert({
      user_id: userId,
      puesto_id,
      store_id: legacyStoreId,
      first_name,
      last_name,
      document: document ?? null,
      phone: phone ?? null,
      email: normalizedEmail,
      role,
      is_active: true,
      created_by: context.user.id,
    })
    .select("id")
    .single();

  if (personaError || !persona) {
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: dbMessage(personaError) };
  }

  const assignmentError = await syncScope(
    admin,
    persona.id,
    role,
    scope_type,
    zone_id,
    cluster_id,
    storeIds,
    context.user.id,
  );

  if (assignmentError) {
    await admin.from("personas").delete().eq("id", persona.id);
    await admin.auth.admin.deleteUser(userId);
    return { ok: false, message: "No se pudo guardar el alcance territorial." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Persona, cuenta, puesto, rol y alcance creados correctamente." };
}

export async function updatePersonUnified(
  _previousState: PersonActionState,
  formData: FormData,
): Promise<PersonActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida o usuario desactivado." };
  if (!contextHasPermission(context, PERMISSIONS.peopleUpdate)) {
    return { ok: false, message: "No tienes permiso para actualizar personas." };
  }

  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: validationMessage(parsed.error) };

  const storeIds = parseStoreIds(formData);
  const {
    persona_id,
    user_id,
    first_name,
    last_name,
    email,
    role,
    puesto_id,
    scope_type,
    zone_id,
    cluster_id,
    document,
    phone,
    new_password,
    is_active,
  } = parsed.data;

  const admin = createAdminClient();
  const { data: currentPersona } = await admin
    .from("personas")
    .select("id, user_id, role")
    .eq("id", persona_id)
    .maybeSingle();

  if (!currentPersona) return { ok: false, message: "No se encontró la persona." };

  const currentRole = currentPersona.role as AppRole;
  if (!canManageRole(context.profile.role, currentRole) || !canManageRole(context.profile.role, role)) {
    return { ok: false, message: "No puedes modificar esta persona o asignarle ese rol." };
  }

  if (!(await validatePosition(context, puesto_id, role))) {
    return { ok: false, message: "El puesto seleccionado no está permitido para esta operación." };
  }

  const scopeError = await validateTerritorialScope(
    context,
    role,
    scope_type,
    zone_id,
    cluster_id,
    storeIds,
  );
  if (scopeError) return { ok: false, message: scopeError };

  const active = is_active === "true";
  const fullName = `${first_name} ${last_name}`.trim();
  const normalizedEmail = email.toLowerCase();
  let targetUserId = user_id ?? currentPersona.user_id;

  if (targetUserId === context.user.id && !active) {
    return { ok: false, message: "No puedes desactivar tu propia cuenta." };
  }
  if (targetUserId === context.user.id && role !== context.profile.role) {
    return { ok: false, message: "No puedes cambiar tu propio rol desde esta pantalla." };
  }

  if (!targetUserId) {
    if (!new_password) {
      return { ok: false, message: "Define una contraseña para crear la cuenta de acceso." };
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
    const { error } = await admin.auth.admin.updateUserById(targetUserId, {
      email: normalizedEmail,
      ...(new_password ? { password: new_password } : {}),
      user_metadata: { full_name: fullName },
    });
    if (error) return { ok: false, message: error.message };
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

  if (profileError) return { ok: false, message: dbMessage(profileError) };

  const legacyStoreId = scope_type === "store" || scope_type === "stores" ? storeIds[0] ?? null : null;
  const { error: personError } = await admin
    .from("personas")
    .update({
      user_id: targetUserId,
      puesto_id,
      store_id: legacyStoreId,
      first_name,
      last_name,
      document: document ?? null,
      phone: phone ?? null,
      email: normalizedEmail,
      role,
      is_active: active,
    })
    .eq("id", persona_id);

  if (personError) return { ok: false, message: dbMessage(personError) };

  const assignmentError = await syncScope(
    admin,
    persona_id,
    role,
    scope_type,
    zone_id,
    cluster_id,
    storeIds,
    context.user.id,
  );

  if (assignmentError) {
    return { ok: false, message: "Los datos se actualizaron, pero el alcance territorial no pudo guardarse." };
  }

  revalidatePath("/dashboard");
  return {
    ok: true,
    message: new_password
      ? "Persona actualizada y contraseña reemplazada."
      : "Persona actualizada correctamente.",
  };
}
