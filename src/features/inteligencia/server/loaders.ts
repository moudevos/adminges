import "server-only";

import { loadMonthlyTracking } from "@/features/cuotas/server/monthly-loaders";
import type { MonthlyCycleDetail } from "@/features/cuotas/domain/monthly-types";
import {
  calculateCommission,
  makeProjection,
  projectTradeInUnits,
  type CommercialLine,
  type ForecastModel,
  type ProjectedMoney,
  type CommissionResult,
} from "@/features/inteligencia/domain/projection";
import { MAIN_WAREHOUSE } from "@/features/inventario/domain/types";
import { createClient } from "@/lib/supabase/server";
import { loadTradeInSaleIds } from "@/features/cuotas/server/trade-in";
import { classifySalesProduct, isScPlusProduct } from "@/features/ventas/domain/product-classification";

export type SCPlusReportRow = {
  sku: string;
  coverage: string;
  tier: number;
  years: number;
  labelMin: number;
  labelMax: number;
  units: number;
  sales: number;
};

export type SellerProjection = {
  id: string;
  name: string;
  role: string;
  active: boolean;
  forecast: ProjectedMoney;
  commission: CommissionResult;
  projectedCommission: CommissionResult;
  scPlusUnits: number;
  scPlusAmount: number;
};

export type ProductInsight = {
  id: string;
  sku: string;
  name: string;
  group: string;
  unitsSold: number;
  amountSold: number;
  remainingStock: number;
  referencePrice: number | null;
};

export type CategoryOpportunity = {
  key: string;
  title: string;
  target: number;
  actual: number;
  shortfall: number;
  meanSuggestedPrice: number | null;
  estimatedUnits: number | null;
  stockUnits: number;
};

export type CommercialIntelligence = {
  schemaReady: boolean;
  message?: string;
  today: string;
  cycles: Array<{ id: string; start: string; end: string }>;
  cycle: MonthlyCycleDetail | null;
  model: ForecastModel;
  general: ProjectedMoney | null;
  sellers: SellerProjection[];
  products: ProductInsight[];
  opportunities: CategoryOpportunity[];
  commission: CommissionResult | null;
  projectedCommission: CommissionResult | null;
  scPlusBreakdown: SCPlusReportRow[];
  scPlusCatalogAvailable: boolean;
  // Trade-in se identifica por método de pago en ventas confirmadas.
  ecoActual: number | null;
  diagnostics?: string;
};

type MetricDbRow = Omit<CommercialLine, "cantidad" | "subtotal"> & {
  cantidad: number | string; subtotal: number | string;
};

function calcEco(lines: CommercialLine[]) {
  const hhpTabs = lines.reduce(
    (sum, line) => sum + (line.es_hhp_tabs ? line.cantidad : 0), 0);
  const wea = lines.reduce(
    (sum, line) => sum + (line.es_wea ? line.cantidad : 0), 0);
  return hhpTabs > 0 ? (wea / hhpTabs) * 100 : null;
}

async function pagedMetrics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  from: string,
  to: string,
) {
  const rows: CommercialLine[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("ventas_metricas_comerciales")
      .select(
        "fecha, venta_id, promotor_id, producto_id, cantidad, subtotal, grupo_reporte, componente_amt, es_sc_plus, es_lamina, es_hhp_tabs, es_acc_sin_wea, es_wea",
      )
      .gte("fecha", from)
      .lte("fecha", to)
      .order("fecha")
      .order("venta_id")
      .order("producto_id")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error("No se pudo consultar las ventas comerciales del ciclo.");
    for (const line of (data ?? []) as MetricDbRow[]) {
      rows.push({ ...line, cantidad: Number(line.cantidad), subtotal: Number(line.subtotal) });
    }
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

type StockRow = {
  id: string;
  sku: string;
  nombre: string;
  precio: number | string | null;
  stock_actual: number | string;
  categoria: string | null;
  categoria_principal: string | null;
  categoria_venta: string | null;
  familia: string | null;
  variante: string | null;
};

async function pagedStock(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const rows: StockRow[] = [];
  const pageSize = 1000;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("inventario_stock")
      .select("row_key, id, sku, nombre, precio, stock_actual, categoria, categoria_principal, categoria_venta, familia, variante")
      .eq("is_active", true)
      .eq("almacen", MAIN_WAREHOUSE)
      .ilike("ubicacion", "stock")
      .order("row_key")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error("No se pudo consultar el stock de la tienda.");
    rows.push(...((data ?? []) as StockRow[]));
    if (!data || data.length < pageSize) break;
  }
  return rows;
}

type PriceRow = { producto_id: string; precio_unitario: number | string };

async function recentPrices(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ids: string[],
) {
  const prices = new Map<string, number>();
  for (let offset = 0; offset < ids.length; offset += 150) {
    const { data, error } = await supabase
      .from("ultimo_precio_venta")
      .select("producto_id, precio_unitario")
      .in("producto_id", ids.slice(offset, offset + 150));
    if (error) throw new Error("No se pudo consultar el último precio vendido.");
    for (const row of (data ?? []) as PriceRow[]) {
      prices.set(row.producto_id, Number(row.precio_unitario));
    }
  }
  return prices;
}

async function buildInsights(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lines: CommercialLine[],
  cycle: MonthlyCycleDetail,
  projected: ProjectedMoney,
) {
  const stock = await pagedStock(supabase);
  const index = new Map<string, ProductInsight>();
  const groupFor = (line: CommercialLine) => line.componente_amt;
  const classifyStock = (row: StockRow): string => {
    const group = classifySalesProduct({
      sku: row.sku,
      name: row.nombre,
      primaryCategory: row.categoria_principal ?? row.categoria,
      saleCategory: row.categoria_venta,
      family: row.familia,
      variant: row.variante,
    });
    if (group === "HHP_SERIE_S" || group === "HHP_SERIE_Z") return "HHP_FP";
    if (group === "HHP_SERIE_A") return "HHP_MASS";
    if (group === "TABLETS") return "TABS";
    if (group === "LAMINAS") return "LAMINAS";
    if (isScPlusProduct({
      name: row.nombre, primaryCategory: row.categoria_principal,
      category: row.categoria, saleCategory: row.categoria_venta,
      family: row.familia, variant: row.variante,
    })) return "SC+";
    if (group === "WEA" || group === "ACCESORIOS") return "ACC";
    return "OTROS";
  };
  const stockByProduct = new Map<string, StockRow & { totalStock: number }>();

  for (const item of stock) {
    const prior = stockByProduct.get(item.id);
    if (prior) prior.totalStock += Number(item.stock_actual);
    else stockByProduct.set(item.id, { ...item, totalStock: Number(item.stock_actual) });
  }
  const ids = [...new Set([...lines.map((line) => line.producto_id), ...stockByProduct.keys()])];
  const prices = await recentPrices(supabase, ids);

  for (const item of stockByProduct.values()) {
    index.set(item.id, {
      id: item.id, sku: item.sku, name: item.nombre,
      group: classifyStock(item), unitsSold: 0, amountSold: 0,
      remainingStock: item.totalStock,
      referencePrice: prices.get(item.id) ?? (Number(item.precio) > 0 ? Number(item.precio) : null),
    });
  }

  // Conservar productos agotados / fuera de Stock que tuvieron ventas.
  const missingIds = [...new Set(lines.map((line) => line.producto_id).filter((id) => !index.has(id)))];
  for (let offset = 0; offset < missingIds.length; offset += 150) {
    const { data, error } = await supabase
      .from("productos")
      .select("id, sku, nombre, precio")
      .in("id", missingIds.slice(offset, offset + 150));
    if (error) throw new Error("No se pudo consultar productos vendidos.");
    for (const item of data ?? []) {
      index.set(item.id, {
        id: item.id, sku: item.sku, name: item.nombre,
        group: "OTROS", unitsSold: 0, amountSold: 0,
        remainingStock: 0,
        referencePrice: prices.get(item.id) ??
          (Number(item.precio) > 0 ? Number(item.precio) : null),
      });
    }
  }

  for (const line of lines) {
    const item = index.get(line.producto_id);
    if (!item) continue;
    item.unitsSold += line.cantidad;
    item.amountSold += line.subtotal;
    if (line.componente_amt !== "OTROS") {
      item.group = groupFor(line);
    } else if (line.es_lamina) {
      item.group = "LAMINAS";
    } else if (line.es_sc_plus) {
      item.group = "SC+";
    }
  }

  const products = [...index.values()]
    .sort((left, right) =>
      right.amountSold - left.amountSold || right.remainingStock - left.remainingStock,
    );

  const groups = [
    { key: "hhpFp", code: "HHP_FP", title: "HHP Premium (S/Z)" },
    { key: "hhpMass", code: "HHP_MASS", title: "HHP Otros (A)" },
    { key: "tabs", code: "TABS", title: "Tablets" },
    { key: "acc", code: "ACC", title: "Accesorios" },
    { key: "scPlus", code: "SC+", title: "SC+" },
    { key: "laminas", code: "LAMINAS", title: "Láminas" },
  ] as const;

  const opportunities: CategoryOpportunity[] = groups.map(({ key, code, title }) => {
    const candidates = products.filter(
      (product) =>
        product.group === code &&
        product.remainingStock > 0 &&
        product.referencePrice !== null &&
        product.referencePrice > 0,
    );
    const totalStock = products
      .filter((product) => product.group === code)
      .reduce((sum, product) => sum + product.remainingStock, 0);
    const totalPrice = candidates.reduce(
      (sum, product) => sum + (product.referencePrice ?? 0) * product.remainingStock,
      0,
    );
    const totalQty = candidates.reduce((sum, product) => sum + product.remainingStock, 0);
    const meanSuggestedPrice = totalQty > 0 ? totalPrice / totalQty : null;
    const shortfall = projected.remaining[key];
    return {
      key, title,
      target: cycle.targets[key],
      actual: projected.actual[key],
      shortfall,
      meanSuggestedPrice,
      // Estimación a precio promedio ponderado del stock restante.
      estimatedUnits: meanSuggestedPrice && shortfall > 0
        ? Math.ceil(shortfall / meanSuggestedPrice)
        : shortfall === 0 ? 0 : null,
      stockUnits: totalStock,
    };
  });

  return { products, opportunities };
}

export async function loadCommercialIntelligence(
  cycleId?: string,
  model: ForecastModel = "plano",
  includeProducts = false,
): Promise<CommercialIntelligence> {
  const tracking = await loadMonthlyTracking(cycleId);
  const common = {
    today: tracking.today, model,
    cycles: tracking.cycles.map((cycle) => ({
      id: cycle.id, start: cycle.startDate, end: cycle.endDate,
    })),
  };
  const empty: CommercialIntelligence = {
    ...common, schemaReady: tracking.schemaReady,
    message: tracking.schemaMessage,
    cycle: tracking.selectedCycle,
    general: null, sellers: [], products: [], opportunities: [],
    commission: null, projectedCommission: null, ecoActual: null,
    scPlusBreakdown: [], scPlusCatalogAvailable: false,
  };
  const cycle = tracking.selectedCycle;
  if (!tracking.schemaReady || !cycle) return empty;
  const supabase = await createClient();

  try {
    const [lines, statusResult] = await Promise.all([
      pagedMetrics(supabase, cycle.startDate, cycle.endDate),
      supabase
        .from("personas")
        .select("id, is_active, puede_vender, estado_laboral"),
    ]);
    if (statusResult.error) throw new Error("No se pudo consultar el estado del personal.");

    // La tienda siempre considera TODAS las ventas históricas.
    // No se filtra por personal activo: una baja no altera logros ni cuotas generales.
    const tradeInSaleIds = await loadTradeInSaleIds(supabase, lines.map((line) => line.venta_id));
    const tradeIn = projectTradeInUnits(
      lines, tradeInSaleIds, cycle.startDate, cycle.endDate, tracking.today, model,
    );
    const general = makeProjection(
      lines, cycle.targets, cycle.startDate, cycle.endDate, tracking.today, model,
    );
    const ecoActual = calcEco(lines.filter((line) => line.fecha <= tracking.today));
    const commission = calculateCommission(
      general.actual, general.targets, ecoActual, cycle.targets.ecoPct,
      tradeIn.actual, cycle.targets.tradeInUnits, tradeIn.penetrationPct,
    );
    const projectedCommission = calculateCommission(
      general.projected, general.targets, ecoActual, cycle.targets.ecoPct,
      tradeIn.projected, cycle.targets.tradeInUnits, tradeIn.penetrationPct,
    );

    const { data: scPlusPlans, error: scPlusError } = await supabase
      .from("sc_plus_planes")
      .select("producto_id, sku, cobertura, escala, vigencia_anios, min_etiqueta, max_etiqueta")
      .order("sku");

    // Las 64 referencias son intangibles: no se consultan en inventario_stock.
    const scPlusBreakdown: SCPlusReportRow[] = (scPlusPlans ?? []).map((plan) => {
      const matching = lines.filter((line) => line.producto_id === plan.producto_id);
      return {
        sku: plan.sku,
        coverage: plan.cobertura,
        tier: Number(plan.escala),
        years: Number(plan.vigencia_anios),
        labelMin: Number(plan.min_etiqueta),
        labelMax: Number(plan.max_etiqueta),
        units: matching.reduce((sum, line) => sum + line.cantidad, 0),
        sales: matching.reduce((sum, line) => sum + line.subtotal, 0),
      };
    });

    const statuses = new Map((statusResult.data ?? []).map((person) => [
      person.id, person,
    ]));
    const sellers: SellerProjection[] = cycle.sellers
      .map((person) => {
        const status = statuses.get(person.id);
        // Vacaciones no desactivan a quien sigue perteneciendo a la plantilla.
        const active = Boolean(status?.is_active && status?.puede_vender);
        const personLines = lines.filter((line) => line.promotor_id === person.id);
        const forecast = makeProjection(
          personLines, person.targets, cycle.startDate, cycle.endDate, tracking.today, model,
        );
        const eco = calcEco(personLines.filter((line) => line.fecha <= tracking.today));
        const personTradeIn = projectTradeInUnits(
          personLines, tradeInSaleIds, cycle.startDate, cycle.endDate, tracking.today, model,
        );
        return {
          id: person.id, name: person.name, role: person.role, active,
          scPlusUnits: personLines.filter((line) => line.es_sc_plus)
            .reduce((sum, line) => sum + line.cantidad, 0),
          scPlusAmount: personLines.filter((line) => line.es_sc_plus)
            .reduce((sum, line) => sum + line.subtotal, 0),
          forecast,
          commission: calculateCommission(
            forecast.actual, forecast.targets, eco, person.targets.ecoPct,
            personTradeIn.actual, person.targets.tradeInUnits, personTradeIn.penetrationPct,
          ),
          projectedCommission: calculateCommission(
            forecast.projected, forecast.targets, eco, person.targets.ecoPct,
            personTradeIn.projected, person.targets.tradeInUnits, personTradeIn.penetrationPct,
          ),
        };
      })
      .filter((seller) => seller.active);

    const { products, opportunities } = includeProducts
      ? await buildInsights(supabase, lines, cycle, general)
      : { products: [], opportunities: [] };

    return {
      ...common, schemaReady: true, cycle, general, sellers,
      products, opportunities, commission, projectedCommission, ecoActual,
      scPlusBreakdown, scPlusCatalogAvailable: !scPlusError,
      diagnostics: "Ciclo original conservado. Trade-in en unidades HHP FP, pagos mixtos una vez.",
    };
  } catch (error) {
    return {
      ...empty, schemaReady: false,
      message: error instanceof Error ? error.message : "No fue posible analizar el ciclo.",
    };
  }
}
