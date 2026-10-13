import "server-only";

import type {
  SaleItemInput,
  SalePaymentInput,
} from "@/features/ventas/domain/types";
import { createClient } from "@/lib/supabase/server";

export type SalesMutationResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

function friendlyError(message: string) {
  const rules: Array<[string, string]> = [
    ["ONLY_CURRENT_DAY", "Solo se puede operar la jornada del día actual."],
    ["DAY_ALREADY_CLOSED", "La jornada de hoy ya fue cerrada."],
    ["ANOTHER_DAY_OPEN", "Existe otra jornada abierta. Ciérrala primero."],
    ["DAY_NOT_OPEN", "La jornada no está abierta."],
    ["PERSON_NOT_ACTIVE", "La persona ya no está activa."],
    ["PERSON_NOT_ON_SHIFT", "El vendedor no tiene un turno activo."],
    ["NO_APPLIED_SNAPSHOT", "No existe un snapshot de inventario aplicado."],
    ["SERIAL_NOT_AVAILABLE", "La serie/IMEI no está disponible en Stock."],
    ["SERIAL_ALREADY_SOLD", "La serie/IMEI ya fue vendida después del último snapshot."],
    ["DUPLICATE_SERIAL_IN_SALE", "La misma serie/IMEI está repetida en la venta."],
    ["SERIAL_QUANTITY_MUST_BE_ONE", "Una serie/IMEI solo puede venderse como una unidad."],
    ["INSUFFICIENT_STOCK", "No hay stock suficiente para completar la venta."],
    ["PAYMENT_TOTAL_MISMATCH", "Los pagos deben sumar exactamente el total de la venta."],
    ["INVALID_PAYMENT_METHOD", "Uno de los métodos de pago no es válido."],
    ["INVALID_PAYMENT_AMOUNT", "Uno de los montos de pago no es válido."],
    ["SALE_ITEMS_REQUIRED", "Agrega al menos un producto a la venta."],
    ["SALE_PAYMENTS_REQUIRED", "Agrega al menos un método de pago."],
  ];

  return rules.find(([code]) => message.includes(code))?.[1] ??
    "No se pudo completar la operación.";
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    return null;
  }

  return supabase;
}

export async function openSalesDay(
  date: string,
): Promise<SalesMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { data, error } = await supabase.rpc("open_sales_day", {
    p_fecha: date,
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true, id: data as string };
}

export async function setSalesShift(input: {
  journeyId: string;
  personId: string;
  onShift: boolean;
}): Promise<SalesMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { error } = await supabase.rpc("set_sales_shift", {
    p_jornada_id: input.journeyId,
    p_persona_id: input.personId,
    p_en_turno: input.onShift,
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true };
}

export async function closeSalesDay(
  journeyId: string,
): Promise<SalesMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { error } = await supabase.rpc("close_sales_day", {
    p_jornada_id: journeyId,
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true };
}

export async function registerSale(input: {
  journeyId: string;
  personId: string;
  items: SaleItemInput[];
  payments: SalePaymentInput[];
  observation?: string;
}): Promise<SalesMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { data, error } = await supabase.rpc("register_sale", {
    p_jornada_id: input.journeyId,
    p_promotor_id: input.personId,
    p_items: input.items,
    p_pagos: input.payments,
    p_observacion: input.observation?.trim() || null,
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true, id: data as string };
}
