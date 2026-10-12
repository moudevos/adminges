import { normalizeCategory } from "@/lib/inventory/categories";
import {
  MAIN_WAREHOUSE,
  type InventoryValidationError,
  type NormalizedInventoryRow,
  type RawInventoryRow,
} from "@/lib/inventory/types";

function cleanText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeSerial(value: string) {
  const serial = value.replace(/\s+/g, "").trim();
  return serial || null;
}

function parseInteger(
  value: string,
  label: string,
  row: RawInventoryRow,
  errors: InventoryValidationError[],
) {
  const normalized = value.trim().replace(",", ".");
  const number = Number(normalized);

  if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0) {
    errors.push({
      row: row.rowNumber,
      code: "INVALID_INTEGER",
      message: label + ' debe ser un entero y llegó "' + value + '".',
      sku: row.sku || undefined,
      serial: row.serial || undefined,
    });
    return null;
  }

  return number;
}

function sanitizeDescription(value: string, sku: string) {
  const cleaned = cleanText(value);
  const expectedPrefix = "[" + sku + "]";

  if (
    cleaned.slice(0, expectedPrefix.length).toUpperCase() ===
    expectedPrefix.toUpperCase()
  ) {
    return cleaned.slice(expectedPrefix.length).trim();
  }

  return cleaned;
}

export function normalizeInventoryRows(rawRows: RawInventoryRow[]) {
  const rows: NormalizedInventoryRow[] = [];
  const errors: InventoryValidationError[] = [];
  const mainWarehouse = MAIN_WAREHOUSE.toLowerCase();

  for (const row of rawRows) {
    const sku = cleanText(row.sku).toUpperCase();
    const serial = normalizeSerial(row.serial);
    const almacen = cleanText(row.warehouse);
    const ubicacion = cleanText(row.location);

    if (!sku) {
      errors.push({
        row: row.rowNumber,
        code: "MISSING_SKU",
        message: "La fila tiene datos pero no tiene SKU.",
        serial: serial ?? undefined,
      });
      continue;
    }

    const cantidadFisica = parseInteger(
      row.quantity,
      "Cantidad",
      row,
      errors,
    );
    const cantidadDisponible = parseInteger(
      row.availableQuantity,
      "Cantidad disponible",
      row,
      errors,
    );

    if (cantidadFisica === null || cantidadDisponible === null) continue;

    if (cantidadDisponible > cantidadFisica) {
      errors.push({
        row: row.rowNumber,
        code: "AVAILABLE_GT_PHYSICAL",
        message: "Cantidad disponible no puede superar a Cantidad.",
        sku,
        serial: serial ?? undefined,
      });
      continue;
    }

    if (serial && cantidadFisica !== 1) {
      errors.push({
        row: row.rowNumber,
        code: "SERIAL_QUANTITY",
        message: "Una fila serializada debe representar exactamente 1 unidad.",
        sku,
        serial,
      });
      continue;
    }

    const category = normalizeCategory(row.category);
    const descripcionOriginal = cleanText(row.product);
    const descripcion = sanitizeDescription(descripcionOriginal, sku) || sku;
    const isOperational =
      almacen.toLowerCase() === mainWarehouse &&
      ubicacion.toLowerCase() === "stock";

    rows.push({
      rowNumber: row.rowNumber,
      sku,
      serial,
      descripcionOriginal,
      descripcion,
      cantidadFisica,
      cantidadDisponible,
      cantidadOperativa: isOperational ? cantidadDisponible : 0,
      almacen,
      ubicacion,
      categoriaOriginal: category.original,
      categoriaPrincipal: category.principal,
      categoriaVenta: category.sale,
      familia: category.family,
      variante: category.variant,
    });
  }

  return { rows, errors };
}
