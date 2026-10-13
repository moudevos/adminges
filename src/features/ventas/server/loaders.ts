import "server-only";

import type {
  SalesCatalogItem,
  SalesMetricProgress,
  SalesPersonOption,
  SalesProgress,
  SalesRegistrationData,
  SalesStaffMember,
} from "@/features/ventas/domain/types";
import { createClient } from "@/lib/supabase/server";

const MAIN_WAREHOUSE = "KIOSKO MALL IQUITOS - KIO37";

export function peruDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
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

function normalizedText(values: Array<string | null | undefined>) {
  return values
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

function isLamina(product: {
  categoria_principal?: string | null;
  categoria_venta?: string | null;
  familia?: string | null;
  variante?: string | null;
  nombre?: string | null;
}) {
  const value = normalizedText([
    product.categoria_principal,
    product.categoria_venta,
    product.familia,
    product.variante,
    product.nombre,
  ]);

  return value.includes("LAMINA");
}

function isScPlus(product: {
  categoria_principal?: string | null;
  categoria_venta?: string | null;
  familia?: string | null;
  variante?: string | null;
  nombre?: string | null;
}) {
  const value = normalizedText([
    product.categoria_principal,
    product.categoria_venta,
    product.familia,
    product.variante,
    product.nombre,
  ]);

  return (
    value.includes("SC+") ||
    value.includes("SC PLUS") ||
    value.includes("SAMSUNG CARE")
  );
}

export async function loadSalesRegistration(): Promise<SalesRegistrationData> {
  const supabase = await createClient();
  const date = peruDateString();

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
    return {
      schemaReady: false,
      schemaMessage:
        "Ventas requiere ejecutar sql/006_ventas_cuotas_equipo_diario.sql.",
      date,
      journey: null,
      people: [],
      staff: [],
      catalog: [],
      sellerCount: 0,
      teamProgress: emptyProgress(),
      totals: { sales: 0, units: 0, amount: 0, laminas: 0, scPlus: 0 },
    };
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

  const { data: journeyData, error: journeyError } = await supabase
    .from("jornadas_venta")
    .select(
      "id, fecha, estado, configurada, opened_at, closed_at, cuota_amt, cuota_laminas, cuota_sc_plus",
    )
    .eq("fecha", date)
    .maybeSingle();

  if (journeyError) {
    return {
      schemaReady: false,
      schemaMessage:
        "Ventas requiere ejecutar sql/006_ventas_cuotas_equipo_diario.sql.",
      date,
      journey: null,
      people,
      staff: [],
      catalog: [],
      sellerCount: 0,
      teamProgress: emptyProgress(),
      totals: { sales: 0, units: 0, amount: 0, laminas: 0, scPlus: 0 },
    };
  }

  const journey = journeyData
    ? {
        id: journeyData.id,
        date: journeyData.fecha,
        status: journeyData.estado as "abierta" | "cerrada",
        configured: Boolean(journeyData.configurada),
        openedAt: journeyData.opened_at,
        closedAt: journeyData.closed_at,
        quotas: {
          amt: Number(journeyData.cuota_amt),
          laminas: Number(journeyData.cuota_laminas),
          scPlus: Number(journeyData.cuota_sc_plus),
        },
      }
    : null;

  const stockResult = await supabase
    .from("inventario_stock")
    .select(
      "id, sku, nombre, categoria, categoria_venta, precio, stock_actual, serials, almacen, ubicacion",
    )
    .eq("is_active", true);

  const catalog: SalesCatalogItem[] = (stockResult.data ?? [])
    .filter(
      (row) =>
        String(row.almacen ?? "").trim().toLowerCase() ===
          MAIN_WAREHOUSE.toLowerCase() &&
        String(row.ubicacion ?? "").trim().toLowerCase() === "stock" &&
        Number(row.stock_actual) > 0,
    )
    .map((row) => ({
      productId: row.id,
      sku: row.sku,
      name: row.nombre,
      category: row.categoria,
      saleCategory: row.categoria_venta,
      price: Number(row.precio),
      available: Number(row.stock_actual),
      serials: Array.isArray(row.serials)
        ? row.serials.filter(
            (serial): serial is string => typeof serial === "string",
          )
        : [],
      warehouse: row.almacen,
      location: row.ubicacion,
    }));

  if (!journey) {
    return {
      schemaReady: true,
      date,
      journey: null,
      people,
      staff: [],
      catalog,
      sellerCount: 0,
      teamProgress: emptyProgress(),
      totals: { sales: 0, units: 0, amount: 0, laminas: 0, scPlus: 0 },
    };
  }

  const [shiftResult, salesResult] = await Promise.all([
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
  ]);

  if (shiftResult.error || salesResult.error) {
    return {
      schemaReady: false,
      schemaMessage:
        "No se pudo cargar la configuración diaria. Verifica SQL 006.",
      date,
      journey,
      people,
      staff: [],
      catalog,
      sellerCount: 0,
      teamProgress: emptyProgress(),
      totals: { sales: 0, units: 0, amount: 0, laminas: 0, scPlus: 0 },
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
        "id, nombre, categoria_principal, categoria_venta, familia, variante",
      )
      .in("id", productIds);

    for (const product of data ?? []) {
      productMap.set(product.id, product);
    }
  }

  const saleMap = new Map(
    confirmedSales.map((sale) => [sale.id, sale]),
  );

  let laminas = 0;
  let scPlus = 0;
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

    if (product && isLamina(product)) {
      laminas += detail.cantidad;
      current.laminas += detail.cantidad;
    }

    if (product && isScPlus(product)) {
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
    laminas:
      sellerCount > 0 ? journey.quotas.laminas / sellerCount : 0,
    scPlus: sellerCount > 0 ? journey.quotas.scPlus / sellerCount : 0,
  };

  const peopleMap = new Map(people.map((person) => [person.id, person]));

  const staff: SalesStaffMember[] = (shiftResult.data ?? [])
    .filter((shift) => Boolean(shift.disponible))
    .map((shift) => {
      const person = peopleMap.get(shift.persona_id);
      if (!person) return null;

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

      return {
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
      } satisfies SalesStaffMember;
    })
    .filter((person): person is SalesStaffMember => person !== null);

  const totalAmount = confirmedSales.reduce(
    (sum, sale) => sum + Number(sale.total),
    0,
  );

  return {
    schemaReady: true,
    date,
    journey,
    people,
    staff,
    catalog,
    sellerCount,
    teamProgress: {
      amt: metric(totalAmount, journey.quotas.amt),
      laminas: metric(laminas, journey.quotas.laminas),
      scPlus: metric(scPlus, journey.quotas.scPlus),
    },
    totals: {
      sales: confirmedSales.length,
      units: details.reduce((sum, detail) => sum + detail.cantidad, 0),
      amount: totalAmount,
      laminas,
      scPlus,
    },
  };
}
