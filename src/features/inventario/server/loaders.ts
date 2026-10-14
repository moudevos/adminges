import "server-only";

import type {
  InventoryStockRow,
  SnapshotHistoryRow,
} from "@/features/inventario/domain/types";
import { createClient } from "@/lib/supabase/server";
import { MAIN_WAREHOUSE } from "@/features/inventario/domain/types";

export type InventoryMovementRow = {
  id: number;
  producto_id: string;
  tipo: string;
  direccion: string;
  cantidad: number;
  fecha: string;
  almacen_origen: string | null;
  ubicacion_origen: string | null;
  almacen_destino: string | null;
  ubicacion_destino: string | null;
};

function mapStockRows(
  stockData: Array<Record<string, unknown>>,
): InventoryStockRow[] {
  return stockData.map((row) => ({
    rowKey: String(row.row_key),
    id: String(row.id),
    sku: String(row.sku),
    nombre: String(row.nombre),
    marca: typeof row.marca === "string" ? row.marca : null,
    categoria: typeof row.categoria === "string" ? row.categoria : null,
    categoriaPrincipal:
      typeof row.categoria_principal === "string"
        ? row.categoria_principal
        : null,
    categoriaVenta:
      typeof row.categoria_venta === "string" ? row.categoria_venta : null,
    costo: Number(row.costo),
    precio: Number(row.precio),
    stockMinimo: Number(row.stock_minimo),
    isActive: Boolean(row.is_active),
    cantidadFisica: Number(row.cantidad_fisica),
    cantidadDisponible: Number(row.cantidad_disponible),
    stockActual: Number(row.stock_actual),
    valorStock: Number(row.valor_stock),
    seriesCount: Number(row.series_count),
    serials: Array.isArray(row.serials)
      ? row.serials.filter(
          (serial): serial is string => typeof serial === "string",
        )
      : [],
    almacen: typeof row.almacen === "string" ? row.almacen : null,
    ubicacion: typeof row.ubicacion === "string" ? row.ubicacion : null,
  }));
}

async function queryInventoryStock() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventario_stock")
    .select(
      "row_key, id, sku, nombre, marca, categoria, categoria_principal, categoria_venta, costo, precio, stock_minimo, is_active, cantidad_fisica, cantidad_disponible, stock_actual, valor_stock, series_count, serials, almacen, ubicacion",
    )
    .eq("is_active", true)
    .order("nombre")
    .order("almacen")
    .order("ubicacion");

  return mapStockRows((data ?? []) as Array<Record<string, unknown>>);
}

export async function loadInventoryStock() {
  return queryInventoryStock();
}

export async function loadInventorySnapshots(): Promise<SnapshotHistoryRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("inventory_snapshots")
    .select(
      "id, snapshot_date, file_name, status, sku_count, unit_count, series_count, new_sku_count, exhausted_sku_count, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(30);

  return (data ?? []).map((row) => ({
    id: row.id,
    snapshotDate: row.snapshot_date,
    fileName: row.file_name,
    status: row.status,
    skuCount: Number(row.sku_count),
    unitCount: Number(row.unit_count),
    seriesCount: Number(row.series_count),
    newSkuCount: Number(row.new_sku_count),
    exhaustedSkuCount: Number(row.exhausted_sku_count),
    createdAt: row.created_at,
  }));
}

/** Análisis del movimiento físico exclusivamente en la ubicación STOCK de KIO37. */
export async function loadInventoryAnalysis() {
  const supabase = await createClient();
  const pageSize = 1000;

  const stock: InventoryStockRow[] = [];
  for (let start = 0; ; start += pageSize) {
    const { data, error } = await supabase
      .from("inventario_stock")
      .select(
        "row_key, id, sku, nombre, marca, categoria, categoria_principal, categoria_venta, costo, precio, stock_minimo, is_active, cantidad_fisica, cantidad_disponible, stock_actual, valor_stock, series_count, serials, almacen, ubicacion",
      )
      .eq("is_active", true)
      .eq("almacen", MAIN_WAREHOUSE)
      .ilike("ubicacion", "stock")
      .order("row_key")
      .range(start, start + pageSize - 1);

    if (error) throw new Error("No se pudo consultar el stock operativo.");
    stock.push(...mapStockRows((data ?? []) as Array<Record<string, unknown>>));
    if (!data || data.length < pageSize) break;
  }

  type KardexRecord = InventoryMovementRow;
  const movementsById = new Map<number, KardexRecord>();
  // Ambos sentidos: una transferencia hacia Stock es entrada;
  // desde Stock es salida. Los movimientos de otras ubicaciones no cuentan.
  for (const side of ["origen", "destino"] as const) {
    for (let start = 0; ; start += pageSize) {
      const { data, error } = await supabase
        .from("inventario_kardex")
        .select(
          "id, producto_id, tipo, direccion, cantidad, fecha, almacen_origen, ubicacion_origen, almacen_destino, ubicacion_destino",
        )
        .eq("almacen_" + side, MAIN_WAREHOUSE)
        .ilike("ubicacion_" + side, "stock")
        .order("id")
        .range(start, start + pageSize - 1);

      if (error) throw new Error("No se pudo consultar el Kardex de Stock.");
      for (const item of data ?? []) {
        movementsById.set(Number(item.id), {
          id: Number(item.id),
          producto_id: item.producto_id,
          tipo: item.tipo,
          direccion: item.direccion,
          cantidad: Number(item.cantidad),
          fecha: item.fecha,
          almacen_origen: item.almacen_origen,
          ubicacion_origen: item.ubicacion_origen,
          almacen_destino: item.almacen_destino,
          ubicacion_destino: item.ubicacion_destino,
        });
      }
      if (!data || data.length < pageSize) break;
    }
  }

  return {
    stock,
    movements: [...movementsById.values()].sort((a, b) => b.id - a.id),
  };
}
