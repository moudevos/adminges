import type {
  ComparableInventoryRow,
  InventoryValidationError,
  NormalizedInventoryRow,
} from "@/lib/inventory/types";

function locationKey(row: { almacen: string; ubicacion: string }) {
  return (
    row.almacen.trim().toLowerCase() +
    "::" +
    row.ubicacion.trim().toLowerCase()
  );
}

export function validateInventoryRows(rows: NormalizedInventoryRow[]) {
  const errors: InventoryValidationError[] = [];
  const serialRows = new Map<string, NormalizedInventoryRow>();
  const skuState = new Map<
    string,
    {
      row: NormalizedInventoryRow;
      serialized: boolean;
      nonSerializedLocations: Set<string>;
    }
  >();

  for (const row of rows) {
    if (row.serial) {
      const previous = serialRows.get(row.serial);
      if (previous) {
        errors.push({
          row: row.rowNumber,
          code: "DUPLICATE_SERIAL",
          message: "La serie " + row.serial + " está duplicada en el archivo.",
          sku: row.sku,
          serial: row.serial,
        });
      } else {
        serialRows.set(row.serial, row);
      }
    }

    const current = skuState.get(row.sku);
    const serialized = Boolean(row.serial);

    if (!current) {
      skuState.set(row.sku, {
        row,
        serialized,
        nonSerializedLocations: serialized
          ? new Set<string>()
          : new Set([locationKey(row)]),
      });
      continue;
    }

    if (current.serialized !== serialized) {
      errors.push({
        row: row.rowNumber,
        code: "MIXED_SERIALIZATION",
        message:
          "El SKU " +
          row.sku +
          " mezcla filas serializadas y no serializadas.",
        sku: row.sku,
        serial: row.serial ?? undefined,
      });
    }

    if (
      current.row.descripcion !== row.descripcion ||
      current.row.categoriaPrincipal !== row.categoriaPrincipal ||
      current.row.categoriaVenta !== row.categoriaVenta ||
      current.row.familia !== row.familia ||
      current.row.variante !== row.variante
    ) {
      errors.push({
        row: row.rowNumber,
        code: "SKU_METADATA_MISMATCH",
        message:
          "El SKU " +
          row.sku +
          " tiene descripción o categoría inconsistente dentro del archivo.",
        sku: row.sku,
        serial: row.serial ?? undefined,
      });
    }

    if (!serialized) {
      const key = locationKey(row);

      if (current.nonSerializedLocations.has(key)) {
        errors.push({
          row: row.rowNumber,
          code: "DUPLICATE_NON_SERIALIZED_LOCATION",
          message:
            "El SKU no serializado " +
            row.sku +
            " repite la misma ubicación dentro del archivo.",
          sku: row.sku,
        });
      } else {
        current.nonSerializedLocations.add(key);
      }
    }
  }

  return errors;
}

export function validateSerializationAgainstCurrent(
  candidate: NormalizedInventoryRow[],
  current: ComparableInventoryRow[],
) {
  const errors: InventoryValidationError[] = [];
  const currentModes = new Map<string, boolean>();
  const candidateModes = new Map<string, boolean>();

  for (const row of current) {
    const mode = currentModes.get(row.sku);
    currentModes.set(row.sku, mode === true || Boolean(row.serial));
  }

  for (const row of candidate) {
    const mode = candidateModes.get(row.sku);
    candidateModes.set(row.sku, mode === true || Boolean(row.serial));
  }

  for (const [sku, candidateSerialized] of candidateModes) {
    if (!currentModes.has(sku)) continue;
    const currentSerialized = currentModes.get(sku) ?? false;

    if (currentSerialized !== candidateSerialized) {
      const row = candidate.find((item) => item.sku === sku);
      errors.push({
        row: row?.rowNumber ?? null,
        code: "SERIALIZATION_CHANGED",
        message:
          "El SKU " +
          sku +
          " cambió entre serializado y no serializado.",
        sku,
      });
    }
  }

  return errors;
}
