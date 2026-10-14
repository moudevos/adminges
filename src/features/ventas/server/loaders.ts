import "server-only";

import {
  classifySalesProduct,
  isLaminaProduct,
  isScPlusProduct,
} from "@/features/ventas/domain/product-classification";
import type {
  OpenSalesDayReference,
  PaymentMethodOption,
  SalesCatalogItem,
  SalesClosureGroup,
  SalesClosureGroupUnits,
  SalesClosureReport,
  SalesDayData,
  SaleHistoryDetailData,
  SaleHistoryItem,
  SaleHistoryPayment,
  SalesDayHistoryItem,
  SalesDaysHistoryData,
  SalesHistoryData,
  SalesHistoryFilters,
  SalesHistoryRow,
  SalesJourney,
  SalesMetricProgress,
  SalesPersonOption,
  SalesProgress,
  SalesStaffMember,
} from "@/features/ventas/domain/types";
import { createClient } from "@/lib/supabase/server";

const MAIN_WAREHOUSE = "KIOSKO MALL IQUITOS - KIO37";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

type JourneyRow = {
  id: string;
  fecha: string;
  estado: string;
  configurada: boolean;
  opened_at: string;
  closed_at: string | null;
  cuota_amt: number | string;
  cuota_laminas: number | string;
  cuota_sc_plus: number | string;
};

export function peruDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function daysAgoDateString(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return peruDateString(date);
}

function initials(names: string, surnames: string) {
  const first = names.trim().charAt(0);
  const second = surnames.trim().charAt(0);
  return (first + second).toUpperCase() || "—";
}

function metric(actual: number, target: number): SalesMetricProgress {
  return {
    actual,
    target,
    percent: target > 0 ? Math.round((actual / target) * 1000) / 10 : 0,
  };
}

function emptyProgress(): SalesProgress {
  return {
    amt: metric(0, 0),
    laminas: metric(0, 0),
    scPlus: metric(0, 0),
  };
}

const CLOSURE_GROUPS: SalesClosureGroup[] = [
  "HHP_SERIE_S",
  "HHP_SERIE_A",
  "HHP_SERIE_Z",
  "TABLETS",
  "WEA",
  "LAMINAS",
];

function emptyGroupUnits(): SalesClosureGroupUnits {
  return {
    HHP_SERIE_S: 0,
    HHP_SERIE_A: 0,
    HHP_SERIE_Z: 0,
    TABLETS: 0,
    WEA: 0,
    LAMINAS: 0,
  };
}

function isClosureGroup(value: string): value is SalesClosureGroup {
  return CLOSURE_GROUPS.includes(value as SalesClosureGroup);
}

function emptyTotals() {
  return { sales: 0, units: 0, amount: 0, laminas: 0, scPlus: 0 };
}

function mapJourney(row: JourneyRow): SalesJourney {
  return {
    id: row.id,
    date: row.fecha,
    status: row.estado === "cerrada" ? "cerrada" : "abierta",
    configured: Boolean(row.configurada),
    openedAt: row.opened_at,
    closedAt: row.closed_at,
    quotas: {
      amt: Number(row.cuota_amt),
      laminas: Number(row.cuota_laminas),
      scPlus: Number(row.cuota_sc_plus),
    },
  };
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

  if (peopleResult.error || puestosResult.error) {
    return { ok: false as const, people: [] as SalesPersonOption[] };
  }

  const puestos = new Map(
    (puestosResult.data ?? []).map((row) => [row.id, row.nombre]),
  );

  const people: SalesPersonOption[] = (peopleResult.data ?? []).map(
    (person) => ({
      id: person.id,
      name: (person.nombres + " " + person.apellidos).trim(),
      initials: initials(person.nombres, person.apellidos),
      role: puestos.get(person.puesto_id) ?? "Personal",
      canSell: Boolean(person.puede_vender),
      active: Boolean(person.is_active),
      employmentState:
        person.estado_laboral === "vacaciones" ? "vacaciones" : "activo",
    }),
  );

  return { ok: true as const, people };
}

async function loadCatalog(supabase: SupabaseClient) {
  const [result, priceResult] = await Promise.all([
    supabase
      .from("inventario_stock")
      .select(
        "id, sku, nombre, categoria, categoria_principal, categoria_venta, familia, variante, precio, stock_actual, serials, almacen, ubicacion",
      )
      .eq("is_active", true),
    supabase
      .from("ultimo_precio_venta")
      .select("producto_id, precio_unitario"),
  ]);

  if (result.error) return [] as SalesCatalogItem[];

  const lastPrices = new Map<string, number>(
    (priceResult.data ?? []).map((row) => [
      row.producto_id,
      Number(row.precio_unitario),
    ]),
  );

  return (result.data ?? [])
    .filter(
      (row) =>
        String(row.almacen ?? "").trim().toLowerCase() ===
          MAIN_WAREHOUSE.toLowerCase() &&
        String(row.ubicacion ?? "").trim().toLowerCase() === "stock" &&
        Number(row.stock_actual) > 0,
    )
    .map((row) => {
      const basePrice = Number(row.precio);
      const lastSalePrice = lastPrices.get(row.id) ?? null;

      return {
        productId: row.id,
        sku: row.sku,
        name: row.nombre,
        category: row.categoria,
        primaryCategory: row.categoria_principal,
        saleCategory: row.categoria_venta,
        family: row.familia,
        variant: row.variante,
        reportGroup: classifySalesProduct({
          sku: row.sku,
          name: row.nombre,
          category: row.categoria,
          primaryCategory: row.categoria_principal,
          saleCategory: row.categoria_venta,
          family: row.familia,
          variant: row.variante,
        }),
        price: lastSalePrice ?? basePrice,
        basePrice,
        lastSalePrice,
        available: Number(row.stock_actual),
        serials: Array.isArray(row.serials)
          ? row.serials.filter(
              (serial): serial is string => typeof serial === "string",
            )
          : [],
        warehouse: row.almacen,
        location: row.ubicacion,
      };
    });
}

async function buildDayData({
  supabase,
  journey,
  people,
  catalog,
  blockingOpenDay = null,
}: {
  supabase: SupabaseClient;
  journey: SalesJourney;
  people: SalesPersonOption[];
  catalog: SalesCatalogItem[];
  blockingOpenDay?: OpenSalesDayReference | null;
}): Promise<SalesDayData> {
  const [shiftResult, salesResult, reportResult, breakageResult] =
    await Promise.all([
      supabase
        .from("jornada_personal")
        .select(
          "persona_id, disponible, vende_hoy, hora_ingreso_programada, en_turno, inicio_turno",
        )
        .eq("jornada_id", journey.id),
      supabase
        .from("ventas")
        .select("id, promotor_id, total, estado")
        .eq("jornada_id", journey.id),
      supabase
        .from("jornada_cierre_reportes")
        .select(
          "jornada_id, cuota_amt, venta_amt, cuota_laminas, venta_laminas, cuota_sc_plus, venta_sc_plus, comentarios, created_at",
        )
        .eq("jornada_id", journey.id)
        .maybeSingle(),
      supabase
        .from("jornada_cierre_quiebres")
        .select("grupo, venta_unid, quiebre, detalle")
        .eq("jornada_id", journey.id),
    ]);

  if (
    shiftResult.error ||
    salesResult.error ||
    reportResult.error ||
    breakageResult.error
  ) {
    return {
      schemaReady: false,
      schemaMessage:
        "No se pudo cargar el día de venta. Verifica que SQL 010 esté aplicado.",
      date: journey.date,
      journey,
      blockingOpenDay,
      people,
      staff: [],
      catalog,
      sellerCount: 0,
      teamProgress: emptyProgress(),
      groupUnits: emptyGroupUnits(),
      closureReport: null,
      totals: emptyTotals(),
    };
  }

  const confirmedSales = (salesResult.data ?? []).filter(
    (sale) => sale.estado === "confirmada",
  );
  const saleIds = confirmedSales.map((sale) => sale.id);

  let details: Array<{
    venta_id: string;
    producto_id: string;
    cantidad: number;
    subtotal: number;
  }> = [];

  if (saleIds.length > 0) {
    const { data } = await supabase
      .from("venta_detalles")
      .select("venta_id, producto_id, cantidad, subtotal")
      .in("venta_id", saleIds);

    details = (data ?? []).map((detail) => ({
      venta_id: detail.venta_id,
      producto_id: detail.producto_id,
      cantidad: Number(detail.cantidad),
      subtotal: Number(detail.subtotal),
    }));
  }

  const productIds = [...new Set(details.map((detail) => detail.producto_id))];
  const productMap = new Map<
    string,
    {
      sku: string | null;
      categoria: string | null;
      categoria_principal: string | null;
      categoria_venta: string | null;
      familia: string | null;
      variante: string | null;
      nombre: string | null;
    }
  >();

  if (productIds.length > 0) {
    const { data } = await supabase
      .from("productos")
      .select(
        "id, sku, nombre, categoria, categoria_principal, categoria_venta, familia, variante",
      )
      .in("id", productIds);

    for (const product of data ?? []) {
      productMap.set(product.id, product);
    }
  }

  const saleMap = new Map(confirmedSales.map((sale) => [sale.id, sale]));
  let laminas = 0;
  let scPlus = 0;
  const groupUnits = emptyGroupUnits();
  const metricsByPerson = new Map<
    string,
    { laminas: number; scPlus: number; units: number }
  >();

  for (const detail of details) {
    const sale = saleMap.get(detail.venta_id);
    if (!sale) continue;

    const product = productMap.get(detail.producto_id);
    const current = metricsByPerson.get(sale.promotor_id) ?? {
      laminas: 0,
      scPlus: 0,
      units: 0,
    };

    current.units += detail.cantidad;

    if (product) {
      const reportGroup = classifySalesProduct(product);
      if (isClosureGroup(reportGroup)) {
        groupUnits[reportGroup] += detail.cantidad;
      }
    }

    if (product && isLaminaProduct(product)) {
      laminas += detail.subtotal;
      current.laminas += detail.subtotal;
    }

    if (product && isScPlusProduct(product)) {
      scPlus += detail.subtotal;
      current.scPlus += detail.subtotal;
    }

    metricsByPerson.set(sale.promotor_id, current);
  }

  const sellerCount = (shiftResult.data ?? []).filter(
    (shift) => shift.disponible && shift.vende_hoy,
  ).length;

  const personalTargets = {
    amt: sellerCount > 0 ? journey.quotas.amt / sellerCount : 0,
    laminas: sellerCount > 0 ? journey.quotas.laminas / sellerCount : 0,
    scPlus: sellerCount > 0 ? journey.quotas.scPlus / sellerCount : 0,
  };

  const peopleMap = new Map(people.map((person) => [person.id, person]));
  const staff: SalesStaffMember[] = [];

  for (const shift of shiftResult.data ?? []) {
    if (!shift.disponible) continue;

    const person = peopleMap.get(shift.persona_id);
    if (!person) continue;

    const personSales = confirmedSales.filter(
      (sale) => sale.promotor_id === person.id,
    );
    const personMetrics = metricsByPerson.get(person.id) ?? {
      laminas: 0,
      scPlus: 0,
      units: 0,
    };
    const total = personSales.reduce(
      (sum, sale) => sum + Number(sale.total),
      0,
    );

    staff.push({
      ...person,
      available: true,
      sellsToday: Boolean(shift.vende_hoy),
      scheduledTime: shift.hora_ingreso_programada
        ? String(shift.hora_ingreso_programada).slice(0, 5)
        : null,
      onShift: Boolean(shift.en_turno),
      shiftStartedAt: shift.inicio_turno ?? null,
      salesCount: personSales.length,
      units: personMetrics.units,
      total,
      progress: {
        amt: metric(total, shift.vende_hoy ? personalTargets.amt : 0),
        laminas: metric(
          personMetrics.laminas,
          shift.vende_hoy ? personalTargets.laminas : 0,
        ),
        scPlus: metric(
          personMetrics.scPlus,
          shift.vende_hoy ? personalTargets.scPlus : 0,
        ),
      },
    });
  }

  const totalAmount = confirmedSales.reduce(
    (sum, sale) => sum + Number(sale.total),
    0,
  );

  const closureReport: SalesClosureReport | null = reportResult.data
    ? {
        journeyId: reportResult.data.jornada_id,
        quotas: {
          amt: Number(reportResult.data.cuota_amt),
          laminas: Number(reportResult.data.cuota_laminas),
          scPlus: Number(reportResult.data.cuota_sc_plus),
        },
        sales: {
          amt: Number(reportResult.data.venta_amt),
          laminas: Number(reportResult.data.venta_laminas),
          scPlus: Number(reportResult.data.venta_sc_plus),
        },
        comments: reportResult.data.comentarios,
        closedAt: reportResult.data.created_at,
        breakages: CLOSURE_GROUPS.map((group) => {
          const row = (breakageResult.data ?? []).find(
            (item) => item.grupo === group,
          );

          return {
            group,
            units: Number(row?.venta_unid ?? 0),
            breakage: Boolean(row?.quiebre),
            detail: row?.detalle ?? null,
          };
        }),
      }
    : null;

  return {
    schemaReady: true,
    date: journey.date,
    journey,
    blockingOpenDay,
    people,
    staff,
    catalog,
    sellerCount,
    teamProgress: {
      amt: metric(totalAmount, journey.quotas.amt),
      laminas: metric(laminas, journey.quotas.laminas),
      scPlus: metric(scPlus, journey.quotas.scPlus),
    },
    groupUnits,
    closureReport,
    totals: {
      sales: confirmedSales.length,
      units: details.reduce((sum, detail) => sum + detail.cantidad, 0),
      amount: totalAmount,
      laminas,
      scPlus,
    },
  };
}

export async function loadCurrentSalesDay(): Promise<SalesDayData> {
  const supabase = await createClient();
  const date = peruDateString();
  const peopleResult = await loadPeople(supabase);

  if (!peopleResult.ok) {
    return {
      schemaReady: false,
      schemaMessage:
        "Ventas requiere ejecutar sql/006_ventas_cuotas_equipo_diario.sql.",
      date,
      journey: null,
      blockingOpenDay: null,
      people: [],
      staff: [],
      catalog: [],
      sellerCount: 0,
      teamProgress: emptyProgress(),
      groupUnits: emptyGroupUnits(),
      closureReport: null,
      totals: emptyTotals(),
    };
  }

  const [todayResult, openResult, catalog] = await Promise.all([
    supabase
      .from("jornadas_venta")
      .select(
        "id, fecha, estado, configurada, opened_at, closed_at, cuota_amt, cuota_laminas, cuota_sc_plus",
      )
      .eq("fecha", date)
      .maybeSingle(),
    supabase
      .from("jornadas_venta")
      .select("id, fecha, configurada")
      .eq("estado", "abierta")
      .order("fecha", { ascending: true })
      .limit(1)
      .maybeSingle(),
    loadCatalog(supabase),
  ]);

  if (todayResult.error || openResult.error) {
    return {
      schemaReady: false,
      schemaMessage:
        "Ventas requiere ejecutar sql/006 y sql/007 antes de continuar.",
      date,
      journey: null,
      blockingOpenDay: null,
      people: peopleResult.people,
      staff: [],
      catalog,
      sellerCount: 0,
      teamProgress: emptyProgress(),
      groupUnits: emptyGroupUnits(),
      closureReport: null,
      totals: emptyTotals(),
    };
  }

  const blockingOpenDay =
    openResult.data && openResult.data.fecha !== date
      ? {
          id: openResult.data.id,
          date: openResult.data.fecha,
          configured: Boolean(openResult.data.configurada),
        }
      : null;

  if (!todayResult.data) {
    return {
      schemaReady: true,
      date,
      journey: null,
      blockingOpenDay,
      people: peopleResult.people,
      staff: [],
      catalog,
      sellerCount: 0,
      teamProgress: emptyProgress(),
      groupUnits: emptyGroupUnits(),
      closureReport: null,
      totals: emptyTotals(),
    };
  }

  return buildDayData({
    supabase,
    journey: mapJourney(todayResult.data as JourneyRow),
    people: peopleResult.people,
    catalog,
    blockingOpenDay,
  });
}

export async function loadSalesDayById(
  id: string,
): Promise<SalesDayData | null> {
  const supabase = await createClient();
  const peopleResult = await loadPeople(supabase);

  if (!peopleResult.ok) return null;

  const { data, error } = await supabase
    .from("jornadas_venta")
    .select(
      "id, fecha, estado, configurada, opened_at, closed_at, cuota_amt, cuota_laminas, cuota_sc_plus",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;

  return buildDayData({
    supabase,
    journey: mapJourney(data as JourneyRow),
    people: peopleResult.people,
    catalog: [],
  });
}

export async function loadSalesDaysHistory(
  from: string,
  to: string,
): Promise<SalesDaysHistoryData> {
  const supabase = await createClient();
  const { data: journeyRows, error } = await supabase
    .from("jornadas_venta")
    .select(
      "id, fecha, estado, configurada, opened_at, closed_at, cuota_amt, cuota_laminas, cuota_sc_plus",
    )
    .gte("fecha", from)
    .lte("fecha", to)
    .order("fecha", { ascending: false });

  if (error || !journeyRows) {
    return { from, to, days: [] };
  }

  const journeys = (journeyRows as JourneyRow[]).map(mapJourney);
  const journeyIds = journeys.map((journey) => journey.id);
  if (journeyIds.length === 0) return { from, to, days: [] };

  const [salesResult, shiftsResult] = await Promise.all([
    supabase
      .from("ventas")
      .select("id, jornada_id, total, estado")
      .in("jornada_id", journeyIds),
    supabase
      .from("jornada_personal")
      .select("jornada_id, disponible, vende_hoy")
      .in("jornada_id", journeyIds),
  ]);

  const confirmedSales = (salesResult.data ?? []).filter(
    (sale) => sale.estado === "confirmada",
  );
  const saleIds = confirmedSales.map((sale) => sale.id);
  const unitsBySale = new Map<string, number>();

  if (saleIds.length > 0) {
    const { data } = await supabase
      .from("venta_detalles")
      .select("venta_id, cantidad")
      .in("venta_id", saleIds);

    for (const detail of data ?? []) {
      unitsBySale.set(
        detail.venta_id,
        (unitsBySale.get(detail.venta_id) ?? 0) + Number(detail.cantidad),
      );
    }
  }

  const days: SalesDayHistoryItem[] = journeys.map((journey) => {
    const daySales = confirmedSales.filter(
      (sale) => sale.jornada_id === journey.id,
    );
    const dayShifts = (shiftsResult.data ?? []).filter(
      (shift) => shift.jornada_id === journey.id && shift.disponible,
    );

    return {
      id: journey.id,
      date: journey.date,
      status: journey.status,
      configured: journey.configured,
      openedAt: journey.openedAt,
      closedAt: journey.closedAt,
      quotas: journey.quotas,
      staffCount: dayShifts.length,
      sellerCount: dayShifts.filter((shift) => shift.vende_hoy).length,
      sales: daySales.length,
      units: daySales.reduce(
        (sum, sale) => sum + (unitsBySale.get(sale.id) ?? 0),
        0,
      ),
      amount: daySales.reduce((sum, sale) => sum + Number(sale.total), 0),
    };
  });

  return { from, to, days };
}


export async function loadPaymentMethods(): Promise<PaymentMethodOption[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("metodos_pago")
    .select(
      "id, codigo, nombre, is_active, requiere_referencia, sort_order, is_system",
    )
    .order("sort_order")
    .order("nombre");

  if (error) return [];

  return (data ?? []).map((method) => ({
    id: method.id,
    code: method.codigo,
    name: method.nombre,
    active: Boolean(method.is_active),
    requiresReference: Boolean(method.requiere_referencia),
    sortOrder: Number(method.sort_order),
    system: Boolean(method.is_system),
  }));
}


function mapSalesHistoryRow(row: {
  id: string;
  jornada_id: string | null;
  fecha: string;
  estado: string;
  total: number | string;
  observacion: string | null;
  anulada_at: string | null;
  anulada_motivo: string | null;
  promotor_id: string;
  promotor_nombre: string;
  unidades: number | string;
  lineas: number | string;
  categorias: unknown;
  tipos: unknown;
  metodos_pago: unknown;
}): SalesHistoryRow {
  return {
    id: row.id,
    journeyId: row.jornada_id,
    date: row.fecha,
    status: row.estado === "anulada" ? "anulada" : "confirmada",
    total: Number(row.total),
    observation: row.observacion,
    reversedAt: row.anulada_at,
    reversalReason: row.anulada_motivo,
    promoterId: row.promotor_id,
    promoterName: row.promotor_nombre,
    units: Number(row.unidades),
    lines: Number(row.lineas),
    categories: Array.isArray(row.categorias)
      ? row.categorias.filter((value): value is string => typeof value === "string")
      : [],
    types: Array.isArray(row.tipos)
      ? row.tipos.filter((value): value is string => typeof value === "string")
      : [],
    paymentMethods: Array.isArray(row.metodos_pago)
      ? row.metodos_pago.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
  };
}

export async function loadSalesHistory(
  filters: SalesHistoryFilters,
): Promise<SalesHistoryData> {
  const supabase = await createClient();
  const pageSize = 25;
  const offset = (Math.max(filters.page, 1) - 1) * pageSize;

  const [peopleResult, productResult, paymentMethods] = await Promise.all([
    supabase
      .from("personas")
      .select("id, nombres, apellidos")
      .order("nombres")
      .order("apellidos"),
    supabase
      .from("productos")
      .select("categoria, categoria_principal, categoria_venta"),
    loadPaymentMethods(),
  ]);

  const promoters = (peopleResult.data ?? []).map((person) => ({
    id: person.id,
    name: (person.nombres + " " + person.apellidos).trim(),
  }));

  const categories = [
    ...new Set(
      (productResult.data ?? [])
        .map((product) => product.categoria_principal ?? product.categoria)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  const types = [
    ...new Set(
      (productResult.data ?? [])
        .map((product) => product.categoria_venta)
        .filter((value): value is string => Boolean(value)),
    ),
  ].sort((a, b) => a.localeCompare(b, "es"));

  let query = supabase
    .from("ventas_historial_resumen")
    .select(
      "id, jornada_id, fecha, estado, total, observacion, anulada_at, anulada_motivo, promotor_id, promotor_nombre, unidades, lineas, categorias, tipos, metodos_pago",
      { count: "exact" },
    )
    .gte("fecha", filters.from + "T00:00:00-05:00")
    .lte("fecha", filters.to + "T23:59:59.999-05:00");

  if (filters.status !== "todos") {
    query = query.eq("estado", filters.status);
  }

  if (filters.promoterId) {
    query = query.eq("promotor_id", filters.promoterId);
  }

  if (filters.category) {
    query = query.contains("categorias", [filters.category]);
  }

  if (filters.type) {
    query = query.contains("tipos", [filters.type]);
  }

  if (filters.paymentMethod) {
    query = query.contains("metodos_pago", [filters.paymentMethod]);
  }

  if (filters.search.trim()) {
    query = query.ilike("busqueda", "%" + filters.search.trim() + "%");
  }

  const { data, error, count } = await query
    .order("fecha", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return {
      schemaReady: false,
      schemaMessage:
        "Histórico de ventas requiere ejecutar sql/009_ventas_historial_reversa_ultimo_precio.sql.",
      filters,
      rows: [],
      total: 0,
      pageSize,
      promoters,
      categories,
      types,
      paymentMethods,
    };
  }

  return {
    schemaReady: true,
    filters,
    rows: (data ?? []).map(mapSalesHistoryRow),
    total: count ?? 0,
    pageSize,
    promoters,
    categories,
    types,
    paymentMethods,
  };
}

export async function loadSaleHistoryDetail(
  id: string,
): Promise<SaleHistoryDetailData> {
  const supabase = await createClient();

  const [summaryResult, detailsResult, paymentsResult, paymentMethods] =
    await Promise.all([
      supabase
        .from("ventas_historial_resumen")
        .select(
          "id, jornada_id, fecha, estado, total, observacion, anulada_at, anulada_motivo, promotor_id, promotor_nombre, unidades, lineas, categorias, tipos, metodos_pago",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("venta_detalles")
        .select(
          "id, producto_id, sku, descripcion, serial, cantidad, precio_unitario, subtotal, productos(categoria, categoria_principal, categoria_venta, familia, variante, nombre)",
        )
        .eq("venta_id", id)
        .order("id"),
      supabase
        .from("venta_pagos")
        .select("id, metodo, monto, referencia")
        .eq("venta_id", id)
        .order("id"),
      loadPaymentMethods(),
    ]);

  if (summaryResult.error) {
    return {
      schemaReady: false,
      schemaMessage:
        "Detalle de venta requiere ejecutar sql/009_ventas_historial_reversa_ultimo_precio.sql.",
      sale: null,
      items: [],
      payments: [],
    };
  }

  if (!summaryResult.data) {
    return {
      schemaReady: true,
      sale: null,
      items: [],
      payments: [],
    };
  }

  const methodNames = new Map(
    paymentMethods.map((method) => [method.code, method.name]),
  );

  const items: SaleHistoryItem[] = (detailsResult.data ?? []).map((detail) => {
    const product = Array.isArray(detail.productos)
      ? detail.productos[0]
      : detail.productos;

    return {
      id: Number(detail.id),
      productId: detail.producto_id,
      sku: detail.sku ?? "",
      name: detail.descripcion ?? product?.nombre ?? "",
      serial: detail.serial,
      quantity: Number(detail.cantidad),
      unitPrice: Number(detail.precio_unitario),
      subtotal: Number(detail.subtotal),
      category: product?.categoria_principal ?? product?.categoria ?? null,
      type: product?.categoria_venta ?? null,
      family: product?.familia ?? null,
      reportGroup: classifySalesProduct({
        sku: detail.sku,
        name: detail.descripcion ?? product?.nombre,
        category: product?.categoria,
        primaryCategory: product?.categoria_principal,
        saleCategory: product?.categoria_venta,
        family: product?.familia,
        variant: product?.variante,
      }),
    };
  });

  const payments: SaleHistoryPayment[] = (paymentsResult.data ?? []).map(
    (payment) => ({
      id: Number(payment.id),
      method: payment.metodo,
      methodName: methodNames.get(payment.metodo) ?? payment.metodo,
      amount: Number(payment.monto),
      reference: payment.referencia,
    }),
  );

  return {
    schemaReady: true,
    sale: mapSalesHistoryRow(summaryResult.data),
    items,
    payments,
  };
}
