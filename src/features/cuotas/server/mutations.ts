import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DailyQuotaMutationResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };

function friendlyError(message: string) {
  if (message.includes("QUOTA_DAY_LOCKED")) {
    return "La cuota ya fue aplicada a una jornada y no puede modificarse.";
  }

  if (message.includes("INVALID_DAILY_TARGETS")) {
    return "Revisa AMT, Láminas y SC+.";
  }

  return "No se pudo guardar la cuota diaria.";
}

export async function saveDailyQuota(input: {
  date: string;
  amt: number;
  laminas: number;
  scPlus: number;
}): Promise<DailyQuotaMutationResult> {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return { ok: false, message: "La sesión expiró." };
  }

  const { data, error } = await supabase.rpc("save_daily_store_quota", {
    p_fecha: input.date,
    p_cuota_amt: input.amt,
    p_cuota_laminas: input.laminas,
    p_cuota_sc_plus: input.scPlus,
  });

  if (error) return { ok: false, message: friendlyError(error.message) };
  return { ok: true, id: data as string };
}
