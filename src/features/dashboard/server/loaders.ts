import "server-only";

import { createClient } from "@/lib/supabase/server";

export type DashboardSummary = {
  date: string;
  salesAmount: number | null;
  salesCount: number | null;
  dailyTarget: number | null;
  progressPercent: number | null;
  partialData: boolean;
};

function limaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function nextDate(date: string) {
  const value = new Date(date + "T12:00:00Z");
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

export async function loadDashboardSummary(): Promise<DashboardSummary> {
  const supabase = await createClient();
  const date = limaDate();

  const [salesResult, journeyResult, quotaResult] = await Promise.all([
    supabase
      .from("ventas")
      .select("total", { count: "exact" })
      .eq("estado", "confirmada")
      .gte("fecha", date + "T00:00:00-05:00")
      .lt("fecha", nextDate(date) + "T00:00:00-05:00")
      .range(0, 999),
    supabase
      .from("jornadas_venta")
      .select("configurada, cuota_amt")
      .eq("fecha", date)
      .maybeSingle(),
    supabase
      .from("cuotas_tienda_diarias")
      .select("cuota_amt")
      .eq("fecha", date)
      .maybeSingle(),
  ]);

  // Supabase pagina resultados: nunca mostrar una suma parcial como si fuera el total.
  const salesComplete =
    !salesResult.error &&
    (salesResult.count === null ||
      salesResult.count <= (salesResult.data?.length ?? 0));

  const salesAmount = salesComplete
    ? (salesResult.data ?? []).reduce(
        (sum, sale) => sum + Number(sale.total),
        0,
      )
    : null;

  const salesCount = salesResult.error
    ? null
    : (salesResult.count ?? salesResult.data?.length ?? 0);

  const dailyTarget =
    journeyResult.error || quotaResult.error
      ? null
      : journeyResult.data?.configurada
        ? Number(journeyResult.data.cuota_amt)
        : quotaResult.data?.cuota_amt != null
          ? Number(quotaResult.data.cuota_amt)
          : null;

  return {
    date,
    salesAmount,
    salesCount,
    dailyTarget,
    progressPercent:
      salesAmount !== null && dailyTarget !== null && dailyTarget > 0
        ? Math.round((salesAmount / dailyTarget) * 1000) / 10
        : null,
    partialData: Boolean(
      salesResult.error ||
        journeyResult.error ||
        quotaResult.error ||
        !salesComplete,
    ),
  };
}
