import "server-only";

import type {
  DailyQuotaForDate,
  DailyQuotaPageData,
  DailyQuotaProgress,
  DailyQuotaRecord,
  DailyQuotaSuggestion,
  DailyQuotaValues,
} from "@/features/cuotas/domain/types";
import { loadSalesDayById } from "@/features/ventas/server/loaders";
import { remainingCalendarDays, remainingDailyQuota } from "@/features/cuotas/domain/daily-suggestion";
import { createClient } from "@/lib/supabase/server";

function metric(actual: number, target: number) {
  return {
    actual,
    target,
    percent: target > 0 ? Math.round((actual / target) * 1000) / 10 : 0,
  };
}

function emptyProgress(values?: DailyQuotaValues | null): DailyQuotaProgress {
  return {
    amt: metric(0, values?.amt ?? 0),
    laminas: metric(0, values?.laminas ?? 0),
    scPlus: metric(0, values?.scPlus ?? 0),
  };
}

function mapQuota(
  row: {
    id: string;
    fecha: string;
    cuota_amt: number | string;
    cuota_laminas: number | string;
    cuota_sc_plus: number | string;
    origen: string;
    updated_at: string;
  },
  journey?: { configurada: boolean; estado: string } | null,
): DailyQuotaRecord {
  return {
    id: row.id,
    date: row.fecha,
    values: {
      amt: Number(row.cuota_amt),
      laminas: Number(row.cuota_laminas),
      scPlus: Number(row.cuota_sc_plus),
    },
    origin: row.origen === "apertura" ? "apertura" : "manual",
    locked: Boolean(journey?.configurada),
    journeyStatus:
      journey?.estado === "abierta" || journey?.estado === "cerrada"
        ? journey.estado
        : null,
    updatedAt: row.updated_at,
  };
}

/**
 * La cuota diaria sugerida viene de las metas del ciclo comercial,
 * NO del promedio de cierres anteriores (que puede desviarse de la cuota).
 *
 * Para una fecha determinada descontamos solo ventas anteriores a ese día:
 * el número propuesto para una jornada no cambia al registrar ventas en ella.
 */
async function loadSuggestion(
  date: string,
): Promise<DailyQuotaSuggestion | null> {
  const supabase = await createClient();
  const { data: cycle, error: cycleError } = await supabase
    .from("cuotas_ciclos_comerciales")
    .select(
      "fecha_inicio, fecha_fin, cuota_amt, cuota_laminas, cuota_sc_plus",
    )
    .lte("fecha_inicio", date)
    .gte("fecha_fin", date)
    .order("fecha_inicio", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sin cuota mensual para esa fecha, no sugerir importes históricos
  // que podrían ser inferiores/superiores al saldo comercial real.
  if (cycleError || !cycle) return null;

  const remainingDays = remainingCalendarDays(date, cycle.fecha_fin);
  if (remainingDays < 1) return null;

  const sold = { amt: 0, laminas: 0, scPlus: 0 };
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data: rows, error } = await supabase
      .from("ventas_metricas_comerciales")
      .select("fecha, venta_id, producto_id, subtotal, componente_amt, es_lamina, es_sc_plus")
      .gte("fecha", cycle.fecha_inicio)
      .lt("fecha", date)
      .order("fecha")
      .order("venta_id")
      .order("producto_id")
      .range(offset, offset + pageSize - 1);

    // No presentar una propuesta parcial como si fuera correcta.
    if (error) return null;

    for (const row of rows ?? []) {
      const amount = Number(row.subtotal);
      if (!Number.isFinite(amount)) return null;

      if (["HHP_FP", "HHP_MASS", "TABS", "ACC"].includes(row.componente_amt)) {
        sold.amt += amount;
      }
      if (row.es_lamina) sold.laminas += amount;
      if (row.es_sc_plus) sold.scPlus += amount;
    }
    if (!rows || rows.length < pageSize) break;
  }

  const values = remainingDailyQuota(
    {
      amt: Number(cycle.cuota_amt),
      laminas: Number(cycle.cuota_laminas),
      scPlus: Number(cycle.cuota_sc_plus),
    },
    sold,
    remainingDays,
  );

  return {
    values,
    basedOnDays: remainingDays,
    label:
      "Saldo del mes comercial dividido entre " +
      remainingDays +
      (remainingDays === 1 ? " día restante" : " días restantes") +
      " (contando la fecha seleccionada; se descuentan ventas confirmadas anteriores)",
  };
}

export async function loadDailyQuotaPage(
  date: string,
): Promise<DailyQuotaPageData> {
  const supabase = await createClient();

  const [selectedResult, historyResult, journeysResult, selectedJourneyResult] =
    await Promise.all([
      supabase
        .from("cuotas_tienda_diarias")
        .select(
          "id, fecha, cuota_amt, cuota_laminas, cuota_sc_plus, origen, updated_at",
        )
        .eq("fecha", date)
        .maybeSingle(),
      supabase
        .from("cuotas_tienda_diarias")
        .select(
          "id, fecha, cuota_amt, cuota_laminas, cuota_sc_plus, origen, updated_at",
        )
        .order("fecha", { ascending: false })
        .limit(90),
      supabase
        .from("jornadas_venta")
        .select("fecha, configurada, estado")
        .order("fecha", { ascending: false })
        .limit(120),
      supabase
        .from("jornadas_venta")
        .select("id, configurada, estado")
        .eq("fecha", date)
        .maybeSingle(),
    ]);

  if (
    selectedResult.error ||
    historyResult.error ||
    journeysResult.error ||
    selectedJourneyResult.error
  ) {
    return {
      schemaReady: false,
      schemaMessage:
        "Cuota diaria requiere ejecutar sql/011_cuota_diaria_tienda.sql.",
      date,
      quota: null,
      suggestion: null,
      progress: emptyProgress(),
      history: [],
    };
  }

  const journeysByDate = new Map(
    (journeysResult.data ?? []).map((journey) => [
      journey.fecha,
      {
        configurada: Boolean(journey.configurada),
        estado: journey.estado,
      },
    ]),
  );

  const quota = selectedResult.data
    ? mapQuota(
        selectedResult.data,
        journeysByDate.get(selectedResult.data.fecha) ??
          (selectedJourneyResult.data
            ? {
                configurada: Boolean(selectedJourneyResult.data.configurada),
                estado: selectedJourneyResult.data.estado,
              }
            : null),
      )
    : null;

  const history = (historyResult.data ?? []).map((row) =>
    mapQuota(row, journeysByDate.get(row.fecha) ?? null),
  );

  let progress = emptyProgress(quota?.values ?? null);

  if (selectedJourneyResult.data?.id) {
    const day = await loadSalesDayById(selectedJourneyResult.data.id);

    if (day?.schemaReady) {
      progress = day.teamProgress;
    }
  }

  const suggestion = await loadSuggestion(date);

  return {
    schemaReady: true,
    date,
    quota,
    suggestion,
    progress,
    history,
  };
}

export async function loadDailyQuotaForDate(
  date: string,
): Promise<DailyQuotaForDate> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("cuotas_tienda_diarias")
    .select(
      "id, fecha, cuota_amt, cuota_laminas, cuota_sc_plus, origen, updated_at",
    )
    .eq("fecha", date)
    .maybeSingle();

  if (error || !data) {
    return {
      quota: null,
      suggestion: await loadSuggestion(date),
    };
  }

  return {
    quota: mapQuota(data, null),
    suggestion: await loadSuggestion(date),
  };
}
