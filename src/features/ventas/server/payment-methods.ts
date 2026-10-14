import "server-only";

import { createClient } from "@/lib/supabase/server";

export type PaymentMethodMutationResult =
  | { ok: true; message?: string }
  | { ok: false; message: string };

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;
  return supabase;
}

export async function createPaymentMethod(input: {
  name: string;
  requiresReference: boolean;
}): Promise<PaymentMethodMutationResult> {
  const name = input.name.trim();
  const code = slugify(name);

  if (name.length < 2 || !code || code.length < 2) {
    return { ok: false, message: "Ingresa un nombre válido." };
  }

  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { data: last } = await supabase
    .from("metodos_pago")
    .select("sort_order")
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("metodos_pago").insert({
    codigo: code,
    nombre: name,
    is_active: true,
    requiere_referencia: input.requiresReference,
    sort_order: Number(last?.sort_order ?? 0) + 10,
    is_system: false,
  });

  if (error) {
    return {
      ok: false,
      message:
        error.code === "23505"
          ? "Ya existe un método de pago con ese nombre."
          : "No se pudo agregar el método de pago.",
    };
  }

  return { ok: true };
}

export async function setPaymentMethodActive(input: {
  id: string;
  active: boolean;
}): Promise<PaymentMethodMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { error } = await supabase
    .from("metodos_pago")
    .update({ is_active: input.active })
    .eq("id", input.id);

  if (error) {
    return { ok: false, message: "No se pudo actualizar el método de pago." };
  }

  return { ok: true };
}

export async function removePaymentMethod(
  id: string,
): Promise<PaymentMethodMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { data: method, error: methodError } = await supabase
    .from("metodos_pago")
    .select("codigo, is_system, es_trade_in")
    .eq("id", id)
    .maybeSingle();

  if (methodError || !method) {
    return { ok: false, message: "El método de pago no existe." };
  }

  const { count } = await supabase
    .from("venta_pagos")
    .select("id", { count: "exact", head: true })
    .eq("metodo", method.codigo);

  if (method.is_system || method.es_trade_in || (count ?? 0) > 0) {
    const { error } = await supabase
      .from("metodos_pago")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      return { ok: false, message: "No se pudo retirar el método de pago." };
    }

    return {
      ok: true,
      message: "Se desactivó para conservar las ventas históricas.",
    };
  }

  const { error } = await supabase.from("metodos_pago").delete().eq("id", id);

  if (error) {
    return { ok: false, message: "No se pudo quitar el método de pago." };
  }

  return { ok: true };
}
