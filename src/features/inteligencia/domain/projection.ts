import type { MonthlyQuotaTargets } from "@/features/cuotas/domain/monthly-types";

export const MONEY_KEYS = ["hhpFp", "hhpMass", "tabs", "acc", "scPlus", "laminas", "amt"] as const;
export type MoneyKey = (typeof MONEY_KEYS)[number];
export type ForecastModel = "plano" | "lineal";

export type CommercialLine = {
  fecha: string;
  venta_id: string;
  promotor_id: string;
  producto_id: string;
  cantidad: number;
  subtotal: number;
  componente_amt: string;
  grupo_reporte: string;
  es_sc_plus: boolean;
  es_lamina: boolean;
  es_hhp_tabs: boolean;
  es_acc_sin_wea: boolean;
  es_wea: boolean;
};

export type MoneyValues = Record<MoneyKey, number>;
export type ProjectedMoney = {
  actual: MoneyValues;
  projected: MoneyValues;
  targets: MoneyValues;
  remaining: MoneyValues;
  elapsedDays: number;
  totalDays: number;
  observedDays: number;
  daysRemaining: number;
  trendAvailable: boolean;
  daily: Array<{ date: string; value: number; accumulated: number }>;
};

export const MONEY_LABELS: Record<MoneyKey, string> = {
  hhpFp: "HHP Premium (S y Z)",
  hhpMass: "HHP Otros (A)",
  tabs: "Tablets",
  acc: "Accesorios",
  scPlus: "SC+",
  laminas: "Láminas",
  amt: "AMT general",
};

export function emptyMoney(): MoneyValues {
  return { hhpFp: 0, hhpMass: 0, tabs: 0, acc: 0, scPlus: 0, laminas: 0, amt: 0 };
}

export function moneyTotals(lines: CommercialLine[]): MoneyValues {
  const result = emptyMoney();
  for (const line of lines) {
    const amount = Number(line.subtotal) || 0;
    switch (line.componente_amt) {
      case "HHP_FP": result.hhpFp += amount; break;
      case "HHP_MASS": result.hhpMass += amount; break;
      case "TABS": result.tabs += amount; break;
      case "ACC": result.acc += amount; break;
    }
    if (line.es_sc_plus) result.scPlus += amount;
    if (line.es_lamina) result.laminas += amount;
  }
  result.amt = result.hhpFp + result.hhpMass + result.tabs + result.acc;
  return result;
}

export function quotaMoney(target: MonthlyQuotaTargets): MoneyValues {
  return {
    hhpFp: target.hhpFp, hhpMass: target.hhpMass, tabs: target.tabs,
    acc: target.acc, scPlus: target.scPlus, laminas: target.laminas, amt: target.amt,
  };
}

export function dateOffset(date: string, days: number): string {
  const parsed = new Date(date + "T12:00:00Z");
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function diffDays(from: string, to: string): number {
  return Math.round(
    (Date.parse(to + "T12:00:00Z") - Date.parse(from + "T12:00:00Z")) /
      86400000,
  );
}

/** Extrapolación plana del promedio diario o regresión sobre VENTAS DIARIAS. */
function extrapolate(series: number[], elapsed: number, model: ForecastModel) {
  const total = series.reduce((a, b) => a + b, 0);
  if (elapsed <= 0) return 0;
  const average = total / elapsed;
  if (model === "plano" || elapsed < 3) return average;

  const meanX = (elapsed - 1) / 2;
  let numerator = 0;
  let denominator = 0;
  for (let day = 0; day < elapsed; day++) {
    numerator += (day - meanX) * (series[day] - average);
    denominator += (day - meanX) ** 2;
  }
  const slope = denominator ? numerator / denominator : 0;
  const intercept = average - slope * meanX;
  // Sumamos solo los días futuros, los ya transcurridos son hechos.
  return (index: number) => Math.max(0, intercept + slope * index);
}

export function makeProjection(
  lines: CommercialLine[],
  targets: MonthlyQuotaTargets,
  start: string,
  end: string,
  today: string,
  model: ForecastModel,
): ProjectedMoney {
  const totalDays = Math.max(1, diffDays(start, end) + 1);
  const elapsedDays =
    today < start ? 0 : Math.min(totalDays, diffDays(start, today) + 1);
  const daysRemaining = totalDays - elapsedDays;
  const daily: ProjectedMoney["daily"] = [];
  const keys = MONEY_KEYS.filter((key) => key !== "amt");
  const values = Object.fromEntries(
    keys.map((key) => [key, new Array<number>(totalDays).fill(0)]),
  ) as Record<Exclude<MoneyKey, "amt">, number[]>;

  for (const line of lines) {
    const offset = diffDays(start, line.fecha);
    if (offset < 0 || offset >= elapsedDays) continue;
    const amount = Number(line.subtotal) || 0;
    if (line.componente_amt === "HHP_FP") values.hhpFp[offset] += amount;
    if (line.componente_amt === "HHP_MASS") values.hhpMass[offset] += amount;
    if (line.componente_amt === "TABS") values.tabs[offset] += amount;
    if (line.componente_amt === "ACC") values.acc[offset] += amount;
    if (line.es_sc_plus) values.scPlus[offset] += amount;
    if (line.es_lamina) values.laminas[offset] += amount;
  }

  const actual = emptyMoney();
  const projected = emptyMoney();

  for (const key of keys) {
    const series = values[key];
    actual[key] = series.slice(0, elapsedDays).reduce((a, b) => a + b, 0);
    const estimate = extrapolate(series.slice(0, elapsedDays), elapsedDays, model);
    let future = 0;
    for (let index = elapsedDays; index < totalDays; index++) {
      future += typeof estimate === "function"
        ? estimate(index)
        : estimate;
    }
    projected[key] = actual[key] + future;
  }

  actual.amt = actual.hhpFp + actual.hhpMass + actual.tabs + actual.acc;
  projected.amt = projected.hhpFp + projected.hhpMass + projected.tabs + projected.acc;

  let accumulated = 0;
  for (let index = 0; index < elapsedDays; index++) {
    const value = values.hhpFp[index] + values.hhpMass[index] +
      values.tabs[index] + values.acc[index];
    accumulated += value;
    daily.push({ date: dateOffset(start, index), value, accumulated });
  }

  const monetaryTargets = quotaMoney(targets);
  const remaining = emptyMoney();
  for (const key of MONEY_KEYS) {
    remaining[key] = Math.max(0, monetaryTargets[key] - actual[key]);
  }

  return {
    actual, projected, targets: monetaryTargets, remaining,
    elapsedDays, totalDays, observedDays: elapsedDays, daysRemaining,
    trendAvailable: elapsedDays >= 3, daily,
  };
}

export type CommissionKey =
  | "hhpFp" | "hhpMass" | "tabs" | "acc" | "tradeIn" | "eco" | "scPlus";
export const COMMISSION_RULES: ReadonlyArray<{
  key: CommissionKey;
  label: string;
  weight: number;
  measure: "S/" | "%";
}> = [
  { key: "hhpFp", label: "HHP PREMIUM", weight: 35, measure: "S/" },
  { key: "hhpMass", label: "HHP OTROS", weight: 27, measure: "S/" },
  { key: "tabs", label: "TABLET", weight: 5, measure: "S/" },
  { key: "acc", label: "ACCESORIOS", weight: 13, measure: "S/" },
  { key: "tradeIn", label: "Trade in", weight: 5, measure: "%" },
  { key: "eco", label: "ECO", weight: 5, measure: "%" },
  { key: "scPlus", label: "SC+", weight: 10, measure: "S/" },
] as const;

export type CommissionResult = {
  rows: Array<{ key: CommissionKey; label: string; weight: number; measure: string;
    raw: number | null; effective: number | null; points: number | null;
    referenceCash: number; }>;
  knownPoints: number;
  incomplete: boolean;
  cashBase: number;
};

export function calculateCommission(
  actual: MoneyValues,
  target: MoneyValues,
  ecoActual: number | null,
  ecoTarget: number,
): CommissionResult {
  const cashBase = 650; // Referencia del cuadro SEP 2026, NO importe liquidable.
  const rows = COMMISSION_RULES.map((rule) => {
    let raw: number | null;
    if (rule.key === "tradeIn") {
      raw = null; // No existe captura verificada de canjes en el esquema.
    } else if (rule.key === "eco") {
      raw = ecoActual !== null && ecoTarget > 0
        ? (ecoActual / ecoTarget) * 100 : null;
    } else {
      raw = target[rule.key] > 0 ? (actual[rule.key] / target[rule.key]) * 100 : null;
    }
    // Por debajo del 70% no desbloquea la caja; tope de 140%.
    const effective = raw === null ? null : raw < 70 ? 0 : Math.min(raw, 140);
    const points = effective === null ? null : (effective * rule.weight) / 100;
    return {
      key: rule.key, label: rule.label, weight: rule.weight,
      measure: rule.measure, raw, effective, points,
      referenceCash: Math.round(cashBase * rule.weight) / 100,
    };
  });
  return {
    rows,
    knownPoints: rows.reduce((sum, row) => sum + (row.points ?? 0), 0),
    incomplete: rows.some((row) => row.points === null),
    cashBase,
  };
}
