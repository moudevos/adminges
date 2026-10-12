import * as XLSX from "xlsx";
import { findHeaderRow, mapRawRow } from "@/features/inventario/domain/headers";
import type {
  InventoryValidationError,
  RawInventoryRow,
} from "@/features/inventario/domain/types";

const columnLabels: Record<string, string> = {
  sku: "Producto/Referencia Interna",
  serial: "Lote/Nº de serie",
  product: "Producto",
  quantity: "Cantidad",
  availableQuantity: "Cantidad disponible",
  warehouse: "Lugar/Almacén",
  location: "Lugar/Nombre de ubicación",
  category: "Categoría de Producto",
};

export function parseInventoryWorkbook(buffer: ArrayBuffer): {
  rows: RawInventoryRow[];
  errors: InventoryValidationError[];
} {
  let workbook: XLSX.WorkBook;

  try {
    workbook = XLSX.read(new Uint8Array(buffer), { type: "array" });
  } catch {
    return {
      rows: [],
      errors: [
        {
          row: null,
          code: "INVALID_WORKBOOK",
          message: "No se pudo leer el archivo Excel/CSV.",
        },
      ],
    };
  }

  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    return {
      rows: [],
      errors: [
        {
          row: null,
          code: "EMPTY_WORKBOOK",
          message: "El archivo no contiene una hoja válida.",
        },
      ],
    };
  }

  const sheet = workbook.Sheets[firstSheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: "",
    blankrows: false,
  }) as unknown[][];

  const header = findHeaderRow(matrix);
  if (!header || header.missing.length > 0) {
    const missing = header?.missing ?? Object.keys(columnLabels);
    return {
      rows: [],
      errors: [
        {
          row: null,
          code: "MISSING_COLUMNS",
          message:
            "Faltan columnas obligatorias: " +
            missing.map((column) => columnLabels[column] ?? column).join(", ") +
            ".",
        },
      ],
    };
  }

  const rows: RawInventoryRow[] = [];

  for (let index = header.index + 1; index < matrix.length; index += 1) {
    const row = matrix[index] ?? [];
    if (row.every((cell) => String(cell ?? "").trim() === "")) continue;
    rows.push(mapRawRow(row, index + 1, header.indexes));
  }

  if (rows.length === 0) {
    return {
      rows: [],
      errors: [
        {
          row: null,
          code: "NO_DATA",
          message: "El archivo no contiene filas de inventario.",
        },
      ],
    };
  }

  return { rows, errors: [] };
}
