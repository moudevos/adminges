import {
  MAIN_WAREHOUSE,
  type ComparableInventoryRow,
  type InventorySnapshotSummary,
  type NormalizedInventoryRow,
} from "@/lib/inventory/types";

function skuSet(rows: Array<{ sku: string }>) {
  return new Set(rows.map((row) => row.sku));
}

function totalUnits(rows: Array<{ cantidadFisica: number }>) {
  return rows.reduce((sum, row) => sum + row.cantidadFisica, 0);
}

function locationBucket(row: { almacen: string; ubicacion: string }) {
  if (row.almacen.trim().toLowerCase() !== MAIN_WAREHOUSE.toLowerCase()) {
    return "Tránsito";
  }

  const location = row.ubicacion.trim();
  const normalized = location
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized === "stock") return "Stock";
  if (normalized === "exhibicion") return "Exhibición";
  if (normalized === "devoluciones") return "Devoluciones";

  return location || "Sin ubicación";
}

function locationTotals(
  rows: Array<{ almacen: string; ubicacion: string; cantidadFisica: number }>,
) {
  const totals = new Map<string, number>();

  for (const row of rows) {
    const bucket = locationBucket(row);
    totals.set(bucket, (totals.get(bucket) ?? 0) + row.cantidadFisica);
  }

  return totals;
}

export function summarizeSnapshot(
  current: ComparableInventoryRow[],
  candidate: NormalizedInventoryRow[],
): InventorySnapshotSummary {
  const currentSkus = skuSet(current);
  const candidateSkus = skuSet(candidate);
  const currentLocations = locationTotals(current);
  const candidateLocations = locationTotals(candidate);
  const locationNames = new Set([
    ...currentLocations.keys(),
    ...candidateLocations.keys(),
  ]);

  const newSkus = [...candidateSkus].filter(
    (sku) => !currentSkus.has(sku),
  ).length;
  const exhaustedSkus = [...currentSkus].filter(
    (sku) => !candidateSkus.has(sku),
  ).length;

  const currentUnits = totalUnits(current);
  const candidateUnits = totalUnits(candidate);
  const skuDifference = candidateSkus.size - currentSkus.size;

  return {
    current: {
      skuCount: currentSkus.size,
      units: currentUnits,
    },
    candidate: {
      skuCount: candidateSkus.size,
      units: candidateUnits,
      series: candidate.filter((row) => row.serial).length,
    },
    difference: {
      skuCount: skuDifference,
      units: candidateUnits - currentUnits,
    },
    newSkus,
    exhaustedSkus,
    warningLargeDifference: Math.abs(skuDifference) > 10,
    locations: [...locationNames]
      .sort((a, b) => a.localeCompare(b, "es"))
      .map((name) => {
        const currentValue = currentLocations.get(name) ?? 0;
        const candidateValue = candidateLocations.get(name) ?? 0;
        return {
          name,
          current: currentValue,
          candidate: candidateValue,
          difference: candidateValue - currentValue,
        };
      }),
  };
}
