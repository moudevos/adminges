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

async function loadSuggestion(
  date: string,
): Promise<DailyQuotaSuggestion | null> {
  const supabase = await createClient();

  const { data: reports, error } = await supabase
    .from("jornada_cierre_reportes")
    .select(
      "jornada_id, venta_amt, venta_laminas, venta_sc_plus, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  if (error || !reports?.length) return null;

  const ids = reports.map((report) => report.jornada_id);
  const { data: journeys } = await supabase
    .from("jornadas_venta")
    .select("id, fecha")
    .in("id", ids);

  const dateByJourney = new Map(
    (journeys ?? []).map((journey) => [journey.id, journey.fecha]),
  );

  const usable = reports
    .map((report) => ({
      report,
      date: dateByJourney.get(report.jornada_id),
    }))
    .filter(
      (
        item,
      ): item is {
        report: (typeof reports)[number];
        date: string;
      } => Boolean(item.date) && item.date < date,
    )
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  if (usable.length === 0) return null;

  const average = (values: number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;

  return {
    values: {
      amt:
        Math.round(
          average(usable.map(({ report }) => Number(report.venta_amt))) * 100,
        ) / 100,
      laminas: Math.round(
        average(
          usable.map(({ report }) => Number(report.venta_laminas)),
        ),
      ),
      scPlus:
        Math.round(
          average(
            usable.map(({ report }) => Number(report.venta_sc_plus)),
          ) * 100,
        ) / 100,
    },
    basedOnDays: usable.length,
    label:
      "Promedio de " +
      usable.length +
      (usable.length === 1 ? " cierre anterior" : " cierres anteriores"),
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
