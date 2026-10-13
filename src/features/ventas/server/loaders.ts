import "server-only";

import type {
  SalesCatalogItem,
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

export async function loadSalesRegistration(): Promise<SalesRegistrationData> {
  const supabase = await createClient();
  const date = peruDateString();

  const { data: people, error: peopleError } = await supabase
    .from("personas")
    .select("id, nombres, apellidos")
    .eq("is_active", true)
    .order("nombres")
    .order("apellidos");

  if (peopleError) {
    return {
      schemaReady: false,
      schemaMessage: "No se pudo cargar el personal activo.",
      date,
      journey: null,
      staff: [],
      catalog: [],
      totals: { sales: 0, units: 0, amount: 0 },
    };
  }

  const { data: journeyData, error: journeyError } = await supabase
    .from("jornadas_venta")
    .select("id, fecha, estado, opened_at, closed_at")
    .eq("fecha", date)
    .maybeSingle();

  if (journeyError) {
    return {
      schemaReady: false,
      schemaMessage:
        "El módulo de Ventas requiere ejecutar sql/005_registro_ventas_jornada.sql.",
      date,
      journey: null,
      staff: (people ?? []).map((person) => ({
        id: person.id,
        name: (person.nombres + " " + person.apellidos).trim(),
        initials: initials(person.nombres, person.apellidos),
        onShift: false,
        shiftStartedAt: null,
        salesCount: 0,
        units: 0,
        total: 0,
      })),
      catalog: [],
      totals: { sales: 0, units: 0, amount: 0 },
    };
  }

  const journey = journeyData
    ? {
        id: journeyData.id,
        date: journeyData.fecha,
        status: journeyData.estado as "abierta" | "cerrada",
        openedAt: journeyData.opened_at,
        closedAt: journeyData.closed_at,
      }
    : null;

  const [shiftResult, salesResult, stockResult] = await Promise.all([
    journey
      ? supabase
          .from("jornada_personal")
          .select("persona_id, en_turno, inicio_turno")
          .eq("jornada_id", journey.id)
      : Promise.resolve({ data: [], error: null }),
    journey
      ? supabase
          .from("ventas")
          .select("id, promotor_id, total, estado")
          .eq("jornada_id", journey.id)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("inventario_stock")
      .select(
        "id, sku, nombre, categoria, categoria_venta, precio, stock_actual, serials, almacen, ubicacion",
      )
      .eq("is_active", true),
  ]);

  if (shiftResult.error || salesResult.error || stockResult.error) {
    return {
      schemaReady: false,
      schemaMessage:
        "No se pudo cargar el estado operativo de Ventas. Verifica SQL 005.",
      date,
      journey,
      staff: [],
      catalog: [],
      totals: { sales: 0, units: 0, amount: 0 },
    };
  }

  const confirmedSales = (salesResult.data ?? []).filter(
    (sale) => sale.estado === "confirmada",
  );
  const saleIds = confirmedSales.map((sale) => sale.id);

  let details: Array<{ venta_id: string; cantidad: number }> = [];

  if (saleIds.length > 0) {
    const { data, error } = await supabase
      .from("venta_detalles")
      .select("venta_id, cantidad")
      .in("venta_id", saleIds);

    if (!error) {
      details = (data ?? []).map((detail) => ({
        venta_id: detail.venta_id,
        cantidad: Number(detail.cantidad),
      }));
    }
  }

  const shifts = new Map(
    (shiftResult.data ?? []).map((shift) => [shift.persona_id, shift]),
  );
  const unitsBySale = new Map<string, number>();

  for (const detail of details) {
    unitsBySale.set(
      detail.venta_id,
      (unitsBySale.get(detail.venta_id) ?? 0) + detail.cantidad,
    );
  }

  const staff: SalesStaffMember[] = (people ?? []).map((person) => {
    const shift = shifts.get(person.id);
    const personSales = confirmedSales.filter(
      (sale) => sale.promotor_id === person.id,
    );

    return {
      id: person.id,
      name: (person.nombres + " " + person.apellidos).trim(),
      initials: initials(person.nombres, person.apellidos),
      onShift: Boolean(shift?.en_turno),
      shiftStartedAt: shift?.inicio_turno ?? null,
      salesCount: personSales.length,
      units: personSales.reduce(
        (sum, sale) => sum + (unitsBySale.get(sale.id) ?? 0),
        0,
      ),
      total: personSales.reduce((sum, sale) => sum + Number(sale.total), 0),
    };
  });

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

  return {
    schemaReady: true,
    date,
    journey,
    staff,
    catalog,
    totals: {
      sales: confirmedSales.length,
      units: details.reduce((sum, detail) => sum + detail.cantidad, 0),
      amount: confirmedSales.reduce(
        (sum, sale) => sum + Number(sale.total),
        0,
      ),
    },
  };
}
