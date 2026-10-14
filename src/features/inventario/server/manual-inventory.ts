import "server-only";

import { classifySalesProduct } from "@/features/ventas/domain/product-classification";
import { MAIN_WAREHOUSE } from "@/features/inventario/domain/types";
import { createClient } from "@/lib/supabase/server";

export type ManualInventoryCategory = "HHP" | "TAB" | "ACC" | "LAMINAS";
export type ManualInventoryLocation = {
  warehouse: string;
  location: string;
  label: string;
};

export type ManualInventoryItem = {
  sku: string;
  name: string;
  expected: number;
  locations: string[];
};

export type ManualInventoryData = {
  date: string;
  warehouse: string;
  location: string;
  groups: Record<ManualInventoryCategory, ManualInventoryItem[]>;
  totalSkus: number;
  totalUnits: number;
};

type StockRow = {
  sku: string;
  nombre: string;
  categoria_principal: string | null;
  categoria_venta: string | null;
  categoria: string | null;
  familia: string | null;
  variante: string | null;
  almacen: string | null;
  ubicacion: string | null;
  cantidad_disponible: number | string;
};

function categoryFor(row: StockRow): ManualInventoryCategory {
  const principal = (row.categoria_principal ?? row.categoria ?? "")
    .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toUpperCase();
  const group = classifySalesProduct(row);
  const detail = [row.categoria_venta, row.familia, row.nombre]
    .filter(Boolean).join(" ")
    .normalize("NFD").replace(/[\\u0300-\\u036f]/g, "").toUpperCase();

  // En el conteo físico HHP y TAB incluyen TODAS sus referencias;
  // no dependen de que el clasificador comercial reconozca un modelo S/A/Z.
  if (group === "LAMINAS" || principal.includes("LAMINA") ||
    /\\bLAMINAS?\\b/.test(detail)) return "LAMINAS";
  if (principal.includes("HHP") || group.startsWith("HHP_")) return "HHP";
  if (principal.includes("TAB") || group === "TABLETS") return "TAB";
  return "ACC";
}

function dateInPeru() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: string) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return [part("year"), part("month"), part("day")].join("-");
}

/** Opciones reales (almacén + ubicación), p. ej. Stock y Exhibición. */
export async function loadManualInventoryLocations(): Promise<ManualInventoryLocation[]> {
  const supabase = await createClient();
  const options = new Map<string, ManualInventoryLocation>();
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("inventario_stock")
      .select("row_key, almacen, ubicacion")
      .eq("is_active", true)
      .gt("cantidad_disponible", 0)
      .order("row_key")
      .range(offset, offset + pageSize - 1);

    if (error) throw new Error("No se pudieron consultar los almacenes.");

    for (const row of data ?? []) {
      const warehouse = String(row.almacen ?? "").trim();
      const location = String(row.ubicacion ?? "").trim();
      if (!warehouse || !location) continue;
      options.set(JSON.stringify([warehouse, location]), {
        warehouse,
        location,
        label: location,
      });
    }

    if (!data || data.length < pageSize) break;
  }

  const values = [...options.values()];
  const warehouses = new Set(values.map((option) => option.warehouse));
  if (warehouses.size > 1) {
    for (const option of values) {
      option.label = option.location + " · " + option.warehouse;
    }
  }

  values.sort((left, right) => {
    const stockFirst = (value: string) => value.toLowerCase() === "stock" ? 0 : 1;
    return stockFirst(left.location) - stockFirst(right.location)
      || left.label.localeCompare(right.label, "es");
  });
  return values;
}

/** El origen del PDF es el stock disponible de la ubicación escogida. */
export async function loadManualInventory(selection?: {
  warehouse: string;
  location: string;
}): Promise<ManualInventoryData> {
  const warehouse = selection?.warehouse ?? MAIN_WAREHOUSE;
  const location = selection?.location ?? "Stock";
  const supabase = await createClient();
  const rows: StockRow[] = [];
  const pageSize = 1000;

  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("inventario_stock")
      .select(
        "row_key, sku, nombre, categoria_principal, categoria_venta, categoria, familia, variante, almacen, ubicacion, cantidad_disponible",
      )
      .eq("is_active", true)
      .eq("almacen", warehouse)
      .eq("ubicacion", location)
      .gt("cantidad_disponible", 0)
      .order("row_key")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error("No se pudo cargar el inventario para conteo manual.");
    }

    rows.push(...((data ?? []) as StockRow[]));
    if (!data || data.length < pageSize) break;
  }

  const groups: ManualInventoryData["groups"] = {
    HHP: [],
    TAB: [],
    ACC: [],
    LAMINAS: [],
  };
  const aggregated = new Map<string, ManualInventoryItem & { category: ManualInventoryCategory }>();

  for (const row of rows) {
    const category = categoryFor(row);
    const sku = String(row.sku).trim();
    if (!sku) continue;

    const key = category + "|" + sku;
    const current = aggregated.get(key);
    const rowLocation = row.ubicacion?.trim() ?? "";
    const quantity = Number(row.cantidad_disponible) || 0;

    if (current) {
      current.expected += quantity;
      if (rowLocation && !current.locations.includes(rowLocation)) {
        current.locations.push(rowLocation);
      }
    } else {
      aggregated.set(key, {
        category,
        sku,
        name: String(row.nombre).trim() || sku,
        expected: quantity,
        locations: rowLocation ? [rowLocation] : [],
      });
    }
  }

  for (const { category, ...item } of aggregated.values()) {
    groups[category].push(item);
  }

  for (const values of Object.values(groups)) {
    values.sort((left, right) =>
      left.name.localeCompare(right.name, "es", { numeric: true }),
    );
  }

  return {
    date: dateInPeru(),
    warehouse,
    location,
    groups,
    totalSkus: aggregated.size,
    totalUnits: [...aggregated.values()].reduce(
      (total, item) => total + item.expected,
      0,
    ),
  };
}
