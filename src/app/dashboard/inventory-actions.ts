"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type InventoryActionState = {
  ok: boolean;
  message: string;
};

const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

const productSchema = z.object({
  sku: z.string().trim().min(1, "Ingresa un SKU.").max(60),
  nombre: z.string().trim().min(2, "Ingresa el nombre del producto.").max(160),
  marca: optionalText(100),
  categoria: optionalText(100),
  costo: z.coerce.number().min(0),
  precio: z.coerce.number().min(0),
  stock_minimo: z.coerce.number().int().min(0),
});

const loadSchema = z.object({
  producto_id: z.string().uuid(),
  cantidad: z.coerce.number().int().positive("La cantidad debe ser mayor a cero."),
  costo_unitario: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.coerce.number().min(0).optional(),
  ),
  referencia: optionalText(120),
  nota: optionalText(300),
});

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  return supabase;
}

export async function createProduct(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const parsed = productSchema.safeParse({
    sku: formData.get("sku"),
    nombre: formData.get("nombre"),
    marca: formData.get("marca"),
    categoria: formData.get("categoria"),
    costo: formData.get("costo"),
    precio: formData.get("precio"),
    stock_minimo: formData.get("stock_minimo"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { error } = await supabase.from("productos").insert({
    sku: parsed.data.sku.toUpperCase(),
    nombre: parsed.data.nombre,
    marca: parsed.data.marca ?? null,
    categoria: parsed.data.categoria ?? null,
    costo: parsed.data.costo,
    precio: parsed.data.precio,
    stock_minimo: parsed.data.stock_minimo,
  });

  if (error) {
    return {
      ok: false,
      message: error.code === "23505" ? "El SKU ya existe." : "No se pudo crear el producto.",
    };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Producto creado correctamente." };
}

export async function registerInventoryLoad(
  _previous: InventoryActionState,
  formData: FormData,
): Promise<InventoryActionState> {
  const parsed = loadSchema.safeParse({
    producto_id: formData.get("producto_id"),
    cantidad: formData.get("cantidad"),
    costo_unitario: formData.get("costo_unitario"),
    referencia: formData.get("referencia"),
    nota: formData.get("nota"),
  });

  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  }

  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { error } = await supabase.from("inventario_movimientos").insert({
    producto_id: parsed.data.producto_id,
    tipo: "carga",
    cantidad: parsed.data.cantidad,
    costo_unitario: parsed.data.costo_unitario ?? null,
    referencia: parsed.data.referencia ?? null,
    nota: parsed.data.nota ?? null,
  });

  if (error) {
    return { ok: false, message: "No se pudo registrar la carga." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Carga registrada correctamente." };
}
