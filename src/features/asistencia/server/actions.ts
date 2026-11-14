"use server";
import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const documentSchema = z.object({ documentType: z.enum(["dni", "ce", "pasaporte"]), document: z.string().trim().min(6).max(20).regex(/^[A-Za-z0-9-]+$/) });
async function client() { const s = await createClient(); const { data, error } = await s.auth.getClaims(); return error || !data?.claims?.sub ? null : s; }
export async function lookupAttendanceEmployee(input: unknown) {
  const p = documentSchema.safeParse(input); if (!p.success) return { ok: false as const, message: "Ingresa un documento válido." };
  const s = await client(); if (!s) return { ok: false as const, message: "La sesión expiró." };
  const { data, error } = await s.rpc("attendance_lookup_self", { p_document_type: p.data.documentType, p_document: p.data.document });
  return error || !data ? { ok: false as const, message: "No estás autorizado para marcar con este documento." } : { ok: true as const, employee: data as { name: string; maskedDocument: string; stores: Array<{ id: string; name: string }>; nextEvent: string } };
}
export async function beginAttendanceAttempt(input: unknown) {
  const p = z.object({ storeId: z.string().uuid(), idempotencyKey: z.string().uuid(), latitude: z.number().finite(), longitude: z.number().finite(), accuracy: z.number().positive() }).safeParse(input);
  if (!p.success) return { ok: false as const, message: "Datos de ubicación inválidos." }; const s = await client(); if (!s) return { ok: false as const, message: "La sesión expiró." };
  const { data, error } = await s.rpc("attendance_begin_attempt", { p_store_id: p.data.storeId, p_idempotency_key: p.data.idempotencyKey, p_latitude: p.data.latitude, p_longitude: p.data.longitude, p_accuracy_meters: p.data.accuracy });
  return error ? { ok: false as const, message: error.message } : { ok: true as const, attempt: data };
}
