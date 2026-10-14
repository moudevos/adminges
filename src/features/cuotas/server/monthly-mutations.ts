import "server-only";

import { createClient } from "@/lib/supabase/server";

export type MonthlyQuotaMutationResult =
  | { ok: true; id: string }
  | { ok: false; message: string };

function friendlyError(message: string) {
  const rules: Array<[string, string]> = [
    [
      "COMMERCIAL_CYCLE_OVERLAP",
      "El rango seleccionado se cruza con otro ciclo comercial.",
    ],
    [
      "INVALID_COMMERCIAL_CYCLE",
      "Selecciona una fecha válida y un ciclo de 4 o 5 semanas.",
    ],
    ["INVALID_MONTHLY_TARGETS", "Revisa los valores de la cuota mensual."],
    [
      "MONTHLY_TEAM_REQUIRED",
      "No hay personal elegible para distribuir la cuota.",
    ],
    [
      "INVALID_MONTHLY_PERSON_DAYS",
      "Los días de una persona exceden la duración del ciclo.",
    ],
    [
      "PERSON_NOT_ELIGIBLE_FOR_MONTHLY_QUOTA",
      "Una persona ya no está activa o habilitada para vender.",
    ],
    [
      "MONTHLY_TEAM_DAYS_REQUIRED",
      "La suma de días planificados debe ser mayor a cero.",
    ],
    ["COMMERCIAL_CYCLE_NOT_FOUND", "El ciclo comercial ya no existe."],
  ];

  return (
    rules.find(([code]) => message.includes(code))?.[1] ??
    "No se pudo guardar la cuota mensual."
  );
}

export async function saveMonthlyCommercialCycle(input: {
  cycleId?: string | null;
  startDate: string;
  weeks: 4 | 5;
  hhpFp: number;
  hhpMass: number;
  tabs: number;
  acc: number;
  scPlus: number;
  laminas: number;
  people: Array<{ personId: string; days: number }>;
}): Promise<MonthlyQuotaMutationResult> {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return { ok: false, message: "La sesión expiró." };
  }

  const { data, error } = await supabase.rpc(
    "save_monthly_commercial_cycle",
    {
      p_ciclo_id: input.cycleId ?? null,
      p_fecha_inicio: input.startDate,
      p_semanas: input.weeks,
      p_cuota_hhp_fp: input.hhpFp,
      p_cuota_hhp_mass: input.hhpMass,
      p_cuota_tabs: input.tabs,
      p_cuota_acc: input.acc,
      p_cuota_sc_plus: input.scPlus,
      p_cuota_laminas: input.laminas,
      p_personal: input.people.map((person) => ({
        persona_id: person.personId,
        dias: person.days,
      })),
    },
  );

  if (error) {
    return { ok: false, message: friendlyError(error.message) };
  }

  return { ok: true, id: data as string };
}
