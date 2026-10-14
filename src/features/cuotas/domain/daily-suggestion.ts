import type { DailyQuotaValues } from "@/features/cuotas/domain/types";

/**
 * Cuota diaria para completar el saldo del ciclo.
 *
 * Calcula en céntimos y redondea hacia arriba: evita que pequeñas
 * diferencias de redondeo dejen un saldo pendiente al final del ciclo.
 */
export function remainingDailyQuota(
  target: DailyQuotaValues,
  soldBeforeDate: DailyQuotaValues,
  daysIncludingDate: number,
): DailyQuotaValues {
  if (!Number.isInteger(daysIncludingDate) || daysIncludingDate <= 0) {
    throw new Error("El número de días restantes debe ser positivo.");
  }

  function requiredDailyAmount(quota: number, completed: number) {
    if (![quota, completed].every(Number.isFinite)) {
      throw new Error("La cuota y las ventas deben ser importes válidos.");
    }

    const targetCents = Math.round(Math.max(0, quota) * 100);
    const completedCents = Math.round(Math.max(0, completed) * 100);
    return Math.ceil(Math.max(0, targetCents - completedCents) / daysIncludingDate) / 100;
  }

  return {
    amt: requiredDailyAmount(target.amt, soldBeforeDate.amt),
    laminas: requiredDailyAmount(target.laminas, soldBeforeDate.laminas),
    scPlus: requiredDailyAmount(target.scPlus, soldBeforeDate.scPlus),
  };
}

/** Fechas YYYY-MM-DD en días de calendario (sin depender del huso del servidor). */
export function remainingCalendarDays(date: string, cycleEndDate: string): number {
  const a = Date.parse(date + "T12:00:00Z");
  const b = Date.parse(cycleEndDate + "T12:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b) || a > b) return 0;
  return Math.round((b - a) / 86_400_000) + 1;
}
