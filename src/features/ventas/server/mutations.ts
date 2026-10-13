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
    ["DAY_ALREADY_CONFIGURED", "La jornada de hoy ya está configurada."],
    ["ANOTHER_DAY_OPEN", "Existe otra jornada abierta. Ciérrala primero."],
    ["DAY_NOT_OPEN", "La jornada no está abierta o no fue configurada."],
    ["INVALID_DAILY_TARGETS", "Revisa las cuotas AMT, Láminas y SC+."],
    ["DAILY_TEAM_REQUIRED", "Selecciona al menos una persona disponible."],
    ["INVALID_TEAM_MEMBER", "Hay un integrante con datos inválidos."],
    ["DUPLICATE_TEAM_MEMBER", "Una persona está repetida en el equipo."],
    ["INVALID_ENTRY_TIME", "La hora de ingreso debe estar entre 09:00 y 19:00."],
    ["PERSON_NOT_ACTIVE", "La persona está inactiva."],
    ["PERSON_ON_VACATION", "Una persona seleccionada está de vacaciones."],
    ["PERSON_CANNOT_SELL", "Una persona marcada para vender no tiene esa capacidad habilitada."],
    ["PERSON_NOT_AVAILABLE", "La persona no está disponible en la jornada."],
    ["PERSON_NOT_ALLOWED_TO_SELL", "La persona no está habilitada para vender hoy."],
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
    ["SALE_NOT_FOUND", "La venta no existe."],
    ["SALE_ALREADY_REVERSED", "La venta ya fue anulada."],
    ["SALE_NOT_REVERSIBLE", "La venta no se puede anular en su estado actual."],
    ["REVERSAL_REASON_REQUIRED", "Ingresa el motivo de la reversa."],
    ["SALE_ITEMS_REQUIRED", "Agrega al menos un producto a la venta."],
    ["SALE_PAYMENTS_REQUIRED", "Agrega al menos un método de pago."],
  ];

  return rules.find(([code]) => message.includes(code))?.[1] ??
    "No se pudo completar la operación.";
}

async function authenticatedClient() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) return null;
  return supabase;
}

export async function openSalesDay(input: {
  date: string;
  quotaAmt: number;
  quotaLaminas: number;
  quotaScPlus: number;
  team: Array<{
    personId: string;
    scheduledTime: string;
    sellsToday: boolean;
  }>;
}): Promise<SalesMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { data, error } = await supabase.rpc("open_sales_day", {
    p_fecha: input.date,
    p_cuota_amt: input.quotaAmt,
    p_cuota_laminas: input.quotaLaminas,
    p_cuota_sc_plus: input.quotaScPlus,
    p_equipo: input.team.map((member) => ({
      persona_id: member.personId,
      hora_ingreso: member.scheduledTime,
      vende_hoy: member.sellsToday,
    })),
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


export async function reverseSale(input: {
  saleId: string;
  reason: string;
}): Promise<SalesMutationResult> {
  const supabase = await authenticatedClient();
  if (!supabase) return { ok: false, message: "La sesión expiró." };

  const { error } = await supabase.rpc("reverse_sale", {
    p_venta_id: input.saleId,
    p_motivo: input.reason.trim(),
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true };
}
