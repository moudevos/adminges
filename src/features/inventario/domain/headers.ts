import type { RawInventoryRow } from "@/features/inventario/domain/types";

type InventoryColumn =
  | "sku"
  | "serial"
  | "product"
  | "quantity"
  | "availableQuantity"
  | "warehouse"
  | "location"
  | "category";

const aliases: Record<InventoryColumn, string[]> = {
  sku: ["producto referencia interna", "referencia interna"],
  serial: ["lote n de serie", "lote no de serie", "lote numero de serie"],
  product: ["producto"],
  quantity: ["cantidad"],
  availableQuantity: ["cantidad disponible"],
  warehouse: ["lugar almacen", "almacen"],
  location: ["lugar nombre de ubicacion", "nombre de ubicacion", "ubicacion"],
  category: ["categoria de producto", "categoria producto"],
};

export function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveHeaderIndexes(header: unknown[]) {
  const normalized = header.map(normalizeHeader);
  const indexes = {} as Record<InventoryColumn, number>;
  const missing: InventoryColumn[] = [];

  for (const [column, names] of Object.entries(aliases) as Array<
    [InventoryColumn, string[]]
  >) {
    const index = normalized.findIndex((value) => names.includes(value));
    if (index === -1) missing.push(column);
    else indexes[column] = index;
  }

  return { indexes, missing };
}

export function findHeaderRow(matrix: unknown[][]) {
  let best:
    | {
        index: number;
        indexes: Record<InventoryColumn, number>;
        missing: InventoryColumn[];
      }
    | undefined;

  for (let index = 0; index < Math.min(matrix.length, 25); index += 1) {
    const result = resolveHeaderIndexes(matrix[index] ?? []);
    if (!best || result.missing.length < best.missing.length) {
      best = { index, ...result };
    }
    if (result.missing.length === 0) return { index, ...result };
  }

  return best;
}

export function mapRawRow(
  row: unknown[],
  rowNumber: number,
  indexes: Record<InventoryColumn, number>,
): RawInventoryRow {
  const cell = (column: InventoryColumn) =>
    String(row[indexes[column]] ?? "").trim();

  return {
    rowNumber,
    sku: cell("sku"),
    serial: cell("serial"),
    product: cell("product"),
    quantity: cell("quantity"),
    availableQuantity: cell("availableQuantity"),
    warehouse: cell("warehouse"),
    location: cell("location"),
    category: cell("category"),
  };
}
