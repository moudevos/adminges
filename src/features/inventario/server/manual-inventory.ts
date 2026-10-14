import "server-only";

import { MAIN_WAREHOUSE } from "@/features/inventario/domain/types";
import { createClient } from "@/lib/supabase/server";

export type ManualInventoryCategory = "HHP" | "TAB" | "ACC" | "LAMINAS";

export type ManualInventoryItem = {
  sku: string;
  name: string;
  expected: number;
  locations: string[];
};

export type ManualInventoryData = {
  date: string;
  warehouse: string;
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
  almacen: string | null;
  ubicacion: string | null;
  cantidad_disponible: number | string;
};

function normalize(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function categoryFor(row: StockRow): ManualInventoryCategory {
  const principal = normalize(row.categoria_principal ?? row.categoria);
  const detail = [row.categoria_venta, row.familia, row.nombre]
    .map(normalize)
    .join(" ");

  if (principal.includes("LAMINA") || detail.includes("LAMINA")) {
    return "LAMINAS";
  }
  if (principal.includes("HHP")) return "HHP";
  if (principal.includes("TAB")) return "TAB";
  // WEA, accesorios de marcas propias y categorías residuales quedan en ACC.
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

export async function loadManualInventory(): Promise<ManualInventoryData> {
  const supabase = await createClient();
  const rows: StockRow[] = [];
  const pageSize = 1000;

  // Evita el límite predeterminado de 1000 filas de la Data API.
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabase
      .from("inventario_stock")
      .select(
        "sku, nombre, categoria_principal, categoria_venta, categoria, familia, almacen, ubicacion, cantidad_disponible",
      )
      .eq("is_active", true)
      .eq("almacen", MAIN_WAREHOUSE)
      .gt("cantidad_disponible", 0)
      .order("sku")
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
    const location = row.ubicacion?.trim() ?? "";
    const quantity = Number(row.cantidad_disponible) || 0;

    if (current) {
      current.expected += quantity;
      if (location && !current.locations.includes(location)) {
        current.locations.push(location);
      }
    } else {
      aggregated.set(key, {
        category,
        sku,
        name: String(row.nombre).trim() || sku,
        expected: quantity,
        locations: location ? [location] : [],
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
    warehouse: MAIN_WAREHOUSE,
    groups,
    totalSkus: aggregated.size,
    totalUnits: [...aggregated.values()].reduce(
      (total, item) => total + item.expected,
      0,
    ),
  };
}
