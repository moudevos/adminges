import "server-only";

import type {
  InventoryStockRow,
  SnapshotHistoryRow,
} from "@/features/inventario/domain/types";
import { createClient } from "@/lib/supabase/server";

export type InventoryMovementRow = {
  id: number;
  producto_id: string;
  tipo: string;
  direccion: string;
  cantidad: number;
  fecha: string;
};

export type InventoryMovementRow = {
  id: number;
  producto_id: string;
  tipo: string;
  direccion: string;
  cantidad: number;
  fecha: string;
};

export type PuestoRow = {
  id: string;
  nombre: string;
};

export type PersonaRow = {
  id: string;
  puesto_id: string;
  nombres: string;
  apellidos: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  is_active: boolean;
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

export async function loadInventoryAnalysis() {
  const supabase = await createClient();

  const [stockResult, movementResult] = await Promise.all([
    supabase
      .from("inventario_stock")
      .select(
        "row_key, id, sku, nombre, marca, categoria, categoria_principal, categoria_venta, costo, precio, stock_minimo, is_active, cantidad_fisica, cantidad_disponible, stock_actual, valor_stock, series_count, serials, almacen, ubicacion",
      )
      .eq("is_active", true)
      .order("nombre")
      .order("almacen")
      .order("ubicacion"),
    supabase
      .from("inventario_kardex")
      .select("id, producto_id, tipo, direccion, cantidad, fecha")
      .order("fecha", { ascending: false })
      .order("id", { ascending: false })
      .limit(200),
  ]);

  const stock = mapStockRows(
    (stockResult.data ?? []) as Array<Record<string, unknown>>,
  );

  const movements: InventoryMovementRow[] = (movementResult.data ?? []).map(
    (row) => ({
      id: Number(row.id),
      producto_id: row.producto_id,
      tipo: row.tipo,
      direccion: row.direccion,
      cantidad: Number(row.cantidad),
      fecha: row.fecha,
    }),
  );

  return { stock, movements };
}
