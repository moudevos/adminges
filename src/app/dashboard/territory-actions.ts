"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { contextHasPermission, getAuthorizationContext } from "@/lib/auth/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type TerritoryActionState = {
  ok: boolean;
  message: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const code = z
  .string()
  .trim()
  .min(2, "Ingresa un código.")
  .max(20)
  .regex(/^[A-Za-z0-9_-]+$/, "Usa letras, números, guion o guion bajo.");

const zoneSchema = z.object({
  code,
  name: z.string().trim().min(2).max(120),
  description: optionalText(250),
});

const clusterSchema = z.object({
  zone_id: z.string().uuid(),
  code,
  name: z.string().trim().min(2).max(120),
  description: optionalText(250),
});

const storeTerritorySchema = z.object({
  store_id: z.string().uuid(),
  zone_id: z.string().uuid(),
  cluster_id: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().uuid().optional(),
  ),
});

async function requireTerritoryManager() {
  const context = await getAuthorizationContext();
  if (!context) return null;
  if (!contextHasPermission(context, PERMISSIONS.territoryManage)) return null;
  return context;
}

function errorMessage(error: { code?: string; message?: string } | null) {
  if (error?.code === "23505") return "Ya existe un registro con ese código.";
  return error?.message ?? "No se pudo completar la operación.";
}

export async function createZone(
  _previous: TerritoryActionState,
  formData: FormData,
): Promise<TerritoryActionState> {
  const context = await requireTerritoryManager();
  if (!context) return { ok: false, message: "No tienes permiso para administrar territorio." };

  const parsed = zoneSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();
  const { error } = await admin.from("zones").insert({
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    created_by: context.user.id,
  });

  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/dashboard");
  return { ok: true, message: "Zona creada correctamente." };
}

export async function createCluster(
  _previous: TerritoryActionState,
  formData: FormData,
): Promise<TerritoryActionState> {
  const context = await requireTerritoryManager();
  if (!context) return { ok: false, message: "No tienes permiso para administrar territorio." };

  const parsed = clusterSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();
  const { error } = await admin.from("clusters").insert({
    zone_id: parsed.data.zone_id,
    code: parsed.data.code.toUpperCase(),
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    created_by: context.user.id,
  });

  if (error) return { ok: false, message: errorMessage(error) };
  revalidatePath("/dashboard");
  return { ok: true, message: "Cluster creado correctamente." };
}

export async function assignStoreTerritory(
  _previous: TerritoryActionState,
  formData: FormData,
): Promise<TerritoryActionState> {
  const context = await requireTerritoryManager();
  if (!context) return { ok: false, message: "No tienes permiso para administrar territorio." };

  const parsed = storeTerritorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };

  const admin = createAdminClient();

  if (parsed.data.cluster_id) {
    const { data: cluster } = await admin
      .from("clusters")
      .select("id, zone_id")
      .eq("id", parsed.data.cluster_id)
      .maybeSingle();

    if (!cluster || cluster.zone_id !== parsed.data.zone_id) {
      return { ok: false, message: "El cluster no pertenece a la zona seleccionada." };
    }
  }

  const { error } = await admin
    .from("stores")
    .update({
      zone_id: parsed.data.zone_id,
      cluster_id: parsed.data.cluster_id ?? null,
    })
    .eq("id", parsed.data.store_id);

  if (error) return { ok: false, message: error.message };
  revalidatePath("/dashboard");
  return { ok: true, message: "Ubicación territorial de la tienda actualizada." };
}
