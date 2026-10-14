import "server-only";

import {
  distributeMonthlyTargets,
  monthlyAmt,
} from "@/features/cuotas/domain/monthly-allocation";
import type {
  MonthlyActuals,
  MonthlyCycleDetail,
  MonthlyCycleSummary,
  MonthlyEligiblePerson,
  MonthlyQuotaPageData,
  MonthlyQuotaTargets,
  MonthlyTrackingData,
} from "@/features/cuotas/domain/monthly-types";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type CycleRow = {
  id: string;
  fecha_inicio: string;
  fecha_fin: string;
  semanas: number;
  dias_comerciales: number;
  cuota_hhp_fp: number | string;
  cuota_hhp_mass: number | string;
  cuota_tabs: number | string;
  cuota_acc: number | string;
  cuota_amt: number | string;
  cuota_sc_plus: number | string;
  cuota_laminas: number | string;
  cuota_ar_pct: number | string;
  cuota_eco_pct: number | string;
  updated_at: string;
};

type MetricRow = {
  promotor_id: string;
  cantidad: number | string;
  subtotal: number | string;
  componente_amt: string;
  es_sc_plus: boolean;
  es_lamina: boolean;
  es_hhp_tabs: boolean;
  es_acc_sin_wea: boolean;
  es_wea: boolean;
};

function peruDateString() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function emptyActuals(): MonthlyActuals {
  return {
    hhpFp: 0,
    hhpMass: 0,
    tabs: 0,
    acc: 0,
    amt: 0,
    scPlus: 0,
    laminas: 0,
    hhpTabsUnits: 0,
    accNonWeaUnits: 0,
    weaUnits: 0,
    arPct: null,
    ecoPct: null,
  };
}

function targetsFromRow(row: CycleRow): MonthlyQuotaTargets {
  return {
    hhpFp: Number(row.cuota_hhp_fp),
    hhpMass: Number(row.cuota_hhp_mass),
    tabs: Number(row.cuota_tabs),
    acc: Number(row.cuota_acc),
    amt: Number(row.cuota_amt),
    scPlus: Number(row.cuota_sc_plus),
    laminas: Number(row.cuota_laminas),
    arPct: Number(row.cuota_ar_pct),
    ecoPct: Number(row.cuota_eco_pct),
  };
}

function aggregateMetrics(rows: MetricRow[]): MonthlyActuals {
  const result = emptyActuals();

  for (const row of rows) {
    const amount = Number(row.subtotal);
    const units = Number(row.cantidad);

    if (row.componente_amt === "HHP_FP") result.hhpFp += amount;
    if (row.componente_amt === "HHP_MASS") result.hhpMass += amount;
    if (row.componente_amt === "TABS") result.tabs += amount;
    if (row.componente_amt === "ACC") result.acc += amount;
    if (row.es_sc_plus) result.scPlus += amount;
    if (row.es_lamina) result.laminas += amount;
    if (row.es_hhp_tabs) result.hhpTabsUnits += units;
    if (row.es_acc_sin_wea) result.accNonWeaUnits += units;
    if (row.es_wea) result.weaUnits += units;
  }

  result.hhpFp = Math.round(result.hhpFp * 100) / 100;
  result.hhpMass = Math.round(result.hhpMass * 100) / 100;
  result.tabs = Math.round(result.tabs * 100) / 100;
  result.acc = Math.round(result.acc * 100) / 100;
  result.amt = monthlyAmt(result);
  result.scPlus = Math.round(result.scPlus * 100) / 100;
  result.laminas = Math.round(result.laminas * 100) / 100;
  // Attach rate: accesorios / equipos; Ecosistema: wearables / equipos.
  // No invertir el denominador: las metas AR/ECO son porcentajes de penetración.
  result.arPct =
    result.hhpTabsUnits > 0
      ? Math.round(
          (result.accNonWeaUnits / result.hhpTabsUnits) * 10000,
        ) / 100
      : null;
  result.ecoPct =
    result.hhpTabsUnits > 0
      ? Math.round((result.weaUnits / result.hhpTabsUnits) * 10000) / 100
      : null;

  return result;
}

async function loadPeople(supabase: SupabaseClient) {
  const [peopleResult, puestosResult] = await Promise.all([
    supabase
      .from("personas")
      .select(
        "id, puesto_id, nombres, apellidos, is_active, puede_vender, estado_laboral",
      )
      .order("nombres")
      .order("apellidos"),
    supabase.from("puestos").select("id, nombre"),
  ]);

  const puestos = new Map(
    (puestosResult.data ?? []).map((puesto) => [puesto.id, puesto.nombre]),
  );

  const allPeople = (peopleResult.data ?? []).map((person) => ({
    id: person.id,
    name: (person.nombres + " " + person.apellidos).trim(),
    role: puestos.get(person.puesto_id) ?? "Personal",
    active: Boolean(person.is_active),
    canSell: Boolean(person.puede_vender),
    employmentState:
      person.estado_laboral === "vacaciones"
        ? ("vacaciones" as const)
        : ("activo" as const),
  }));

  const eligible: MonthlyEligiblePerson[] = allPeople
    .filter((person) => person.active && person.canSell)
    .map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      employmentState: person.employmentState,
    }));

  return {
    ok: !peopleResult.error && !puestosResult.error,
    allPeople,
    eligible,
  };
}

async function loadCycleRows(supabase: SupabaseClient) {
  return supabase
    .from("cuotas_ciclos_comerciales")
    .select(
      "id, fecha_inicio, fecha_fin, semanas, dias_comerciales, cuota_hhp_fp, cuota_hhp_mass, cuota_tabs, cuota_acc, cuota_amt, cuota_sc_plus, cuota_laminas, cuota_ar_pct, cuota_eco_pct, updated_at",
    )
    .order("fecha_inicio", { ascending: false })
    .limit(36);
}

function summaryFromRow(
  row: CycleRow,
  totalPersonDays: number,
  actuals = emptyActuals(),
): MonthlyCycleSummary {
  return {
    id: row.id,
    startDate: row.fecha_inicio,
    endDate: row.fecha_fin,
    weeks: row.semanas === 5 ? 5 : 4,
    commercialDays: row.dias_comerciales === 35 ? 35 : 28,
    targets: targetsFromRow(row),
    totalPersonDays,
    actuals,
    updatedAt: row.updated_at,
  };
}

function dateDiffInclusive(from: string, to: string) {
  const start = Date.parse(from + "T00:00:00Z");
  const end = Date.parse(to + "T00:00:00Z");
  return Math.floor((end - start) / 86_400_000) + 1;
}

function suggestedDailyTargets(
  targets: MonthlyQuotaTargets,
  actuals: MonthlyActuals,
  daysRemaining: number,
): MonthlyQuotaTargets | null {
  if (daysRemaining <= 0) return null;

  const daily = (target: number, actual: number) =>
    Math.round((Math.max(target - actual, 0) / daysRemaining) * 100) / 100;

  const hhpFp = daily(targets.hhpFp, actuals.hhpFp);
  const hhpMass = daily(targets.hhpMass, actuals.hhpMass);
  const tabs = daily(targets.tabs, actuals.tabs);
  const acc = daily(targets.acc, actuals.acc);

  return {
    hhpFp,
    hhpMass,
    tabs,
    acc,
    amt: monthlyAmt({ hhpFp, hhpMass, tabs, acc }),
    scPlus: daily(targets.scPlus, actuals.scPlus),
    laminas: daily(targets.laminas, actuals.laminas),
    arPct: targets.arPct,
    ecoPct: targets.ecoPct,
  };
}

async function loadCycleDetail(
  supabase: SupabaseClient,
  row: CycleRow,
  allPeople: Array<{
    id: string;
    name: string;
    role: string;
  }>,
  today: string,
): Promise<MonthlyCycleDetail> {
  const [participantsResult, metricsResult] = await Promise.all([
    supabase
      .from("cuotas_ciclo_personal")
      .select("persona_id, dias_planificados")
      .eq("ciclo_id", row.id),
    supabase
      .from("ventas_metricas_comerciales")
      .select(
        "promotor_id, cantidad, subtotal, componente_amt, es_sc_plus, es_lamina, es_hhp_tabs, es_acc_sin_wea, es_wea",
      )
      .gte("fecha", row.fecha_inicio)
      .lte("fecha", row.fecha_fin),
  ]);

  const participants = (participantsResult.data ?? []).map((item) => ({
    id: item.persona_id,
    days: Number(item.dias_planificados),
  }));

  const totalPersonDays = participants.reduce(
    (sum, participant) => sum + participant.days,
    0,
  );
  const targets = targetsFromRow(row);
  const allocations = distributeMonthlyTargets(
    {
      hhpFp: targets.hhpFp,
      hhpMass: targets.hhpMass,
      tabs: targets.tabs,
      acc: targets.acc,
      scPlus: targets.scPlus,
      laminas: targets.laminas,
      arPct: targets.arPct,
      ecoPct: targets.ecoPct,
    },
    participants,
  );

  const metrics = (metricsResult.data ?? []) as MetricRow[];
  const peopleMap = new Map(allPeople.map((person) => [person.id, person]));

  const sellers = participants.map((participant) => {
    const person = peopleMap.get(participant.id);
    const actuals = aggregateMetrics(
      metrics.filter((metric) => metric.promotor_id === participant.id),
    );

    return {
      id: participant.id,
      name: person?.name ?? "Personal",
      role: person?.role ?? "Personal",
      days: participant.days,
      share:
        totalPersonDays > 0
          ? Math.round((participant.days / totalPersonDays) * 10000) / 100
          : 0,
      targets:
        allocations[participant.id] ?? {
          hhpFp: 0,
          hhpMass: 0,
          tabs: 0,
          acc: 0,
          amt: 0,
          scPlus: 0,
          laminas: 0,
          arPct: targets.arPct,
          ecoPct: targets.ecoPct,
        },
      actuals,
    };
  });

  const actuals = aggregateMetrics(metrics);
  const status =
    today < row.fecha_inicio
      ? "proximo"
      : today > row.fecha_fin
        ? "finalizado"
        : "activo";
  const daysRemaining =
    status === "activo" ? dateDiffInclusive(today, row.fecha_fin) : 0;

  return {
    ...summaryFromRow(row, totalPersonDays, actuals),
    sellers,
    status,
    daysRemaining,
    suggestedDaily:
      status === "activo"
        ? suggestedDailyTargets(targets, actuals, daysRemaining)
        : null,
  };
}

export async function loadMonthlyQuotaPage(
  selectedCycleId?: string,
): Promise<MonthlyQuotaPageData> {
  const supabase = await createClient();
  const today = peruDateString();
  const [cyclesResult, people] = await Promise.all([
    loadCycleRows(supabase),
    loadPeople(supabase),
  ]);

  if (cyclesResult.error || !people.ok) {
    return {
      schemaReady: false,
      schemaMessage:
        "Cuota mensual requiere ejecutar sql/013_cuotas_ar_eco_pct_laminas_monto.sql.",
      today,
      eligiblePeople: [],
      cycles: [],
      selectedCycle: null,
    };
  }

  const rows = (cyclesResult.data ?? []) as CycleRow[];
  const cycleIds = rows.map((row) => row.id);
  const participantResult =
    cycleIds.length > 0
      ? await supabase
          .from("cuotas_ciclo_personal")
          .select("ciclo_id, dias_planificados")
          .in("ciclo_id", cycleIds)
      : { data: [], error: null };

  const daysByCycle = new Map<string, number>();
  for (const participant of participantResult.data ?? []) {
    daysByCycle.set(
      participant.ciclo_id,
      (daysByCycle.get(participant.ciclo_id) ?? 0) +
        Number(participant.dias_planificados),
    );
  }

  const cycles = rows.map((row) =>
    summaryFromRow(row, daysByCycle.get(row.id) ?? 0),
  );

  const selectedRow = selectedCycleId
    ? rows.find((row) => row.id === selectedCycleId)
    : undefined;
  const selectedCycle = selectedRow
    ? await loadCycleDetail(supabase, selectedRow, people.allPeople, today)
    : null;

  return {
    schemaReady: true,
    today,
    eligiblePeople: people.eligible,
    cycles,
    selectedCycle,
  };
}

export async function loadMonthlyTracking(
  selectedCycleId?: string,
): Promise<MonthlyTrackingData> {
  const supabase = await createClient();
  const today = peruDateString();
  const [cyclesResult, people] = await Promise.all([
    loadCycleRows(supabase),
    loadPeople(supabase),
  ]);

  if (cyclesResult.error || !people.ok) {
    return {
      schemaReady: false,
      schemaMessage:
        "Seguimiento mensual requiere ejecutar sql/013_cuotas_ar_eco_pct_laminas_monto.sql.",
      today,
      cycles: [],
      selectedCycle: null,
    };
  }

  const rows = (cyclesResult.data ?? []) as CycleRow[];
  const selectedRow =
    (selectedCycleId
      ? rows.find((row) => row.id === selectedCycleId)
      : rows.find(
          (row) => row.fecha_inicio <= today && row.fecha_fin >= today,
        )) ?? rows[0];

  const cycleIds = rows.map((row) => row.id);
  const participantResult =
    cycleIds.length > 0
      ? await supabase
          .from("cuotas_ciclo_personal")
          .select("ciclo_id, dias_planificados")
          .in("ciclo_id", cycleIds)
      : { data: [], error: null };

  const daysByCycle = new Map<string, number>();
  for (const participant of participantResult.data ?? []) {
    daysByCycle.set(
      participant.ciclo_id,
      (daysByCycle.get(participant.ciclo_id) ?? 0) +
        Number(participant.dias_planificados),
    );
  }

  const cycles = rows.map((row) =>
    summaryFromRow(row, daysByCycle.get(row.id) ?? 0),
  );

  return {
    schemaReady: true,
    today,
    cycles,
    selectedCycle: selectedRow
      ? await loadCycleDetail(
          supabase,
          selectedRow,
          people.allPeople,
          today,
        )
      : null,
  };
}
