import "server-only";

import type {
  InventoryKardexMovement,
  InventoryMovementSearchMode,
  InventoryMovementSearchResponse,
  InventoryMovementSearchResult,
} from "@/features/inventario/domain/types";
import { createClient } from "@/lib/supabase/server";

type ProductRecord = {
  id: string;
  sku: string;
  nombre: string;
};

type KardexRecord = {
  id: number | string;
  serial: string | null;
  direccion: InventoryKardexMovement["direccion"];
  tipo: InventoryKardexMovement["tipo"];
  clasificacion: InventoryKardexMovement["clasificacion"];
  cantidad: number | string;
  almacen_origen: string | null;
  ubicacion_origen: string | null;
  almacen_destino: string | null;
  ubicacion_destino: string | null;
  fecha: string;
};

type SearchInput = {
  mode: InventoryMovementSearchMode;
  query: string;
};

const PAGE_SIZE = 1000;

function movementDelta(movement: InventoryKardexMovement) {
  if (movement.direccion === "entrada") return movement.cantidad;
  if (movement.direccion === "salida") return -movement.cantidad;
  return 0;
}

function mapMovement(
  row: KardexRecord,
  product: ProductRecord,
): InventoryKardexMovement {
  return {
    id: Number(row.id),
    fecha: row.fecha,
    sku: product.sku,
    descripcion: product.nombre,
    serial: row.serial,
    direccion: row.direccion,
    tipo: row.tipo,
    clasificacion: row.clasificacion,
    cantidad: Number(row.cantidad),
    almacenOrigen: row.almacen_origen,
    ubicacionOrigen: row.ubicacion_origen,
    almacenDestino: row.almacen_destino,
    ubicacionDestino: row.ubicacion_destino,
  };
}

function consolidationKey(movement: InventoryKardexMovement) {
  return [
    movement.fecha,
    movement.direccion,
    movement.tipo,
    movement.clasificacion,
    movement.almacenOrigen ?? "",
    movement.ubicacionOrigen ?? "",
    movement.almacenDestino ?? "",
    movement.ubicacionDestino ?? "",
  ].join("::");
}

export function consolidateSkuMovements(
  movements: InventoryKardexMovement[],
): InventoryKardexMovement[] {
  const grouped = new Map<string, InventoryKardexMovement>();

  for (const movement of movements) {
    const key = consolidationKey(movement);
    const existing = grouped.get(key);

    if (existing) {
      existing.cantidad += movement.cantidad;
      existing.id = Math.min(existing.id, movement.id);
      continue;
    }

    grouped.set(key, {
      ...movement,
      serial: null,
    });
  }

  return [...grouped.values()].sort((a, b) => {
    const dateComparison = a.fecha.localeCompare(b.fecha);
    if (dateComparison !== 0) return dateComparison;
    return a.id - b.id;
  });
}

async function fetchMovements({
  productoId,
  serial,
}: {
  productoId?: string;
  serial?: string;
}) {
  const supabase = await createClient();
  const rows: KardexRecord[] = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase
      .from("inventario_kardex")
      .select(
        "id, serial, direccion, tipo, clasificacion, cantidad, almacen_origen, ubicacion_origen, almacen_destino, ubicacion_destino, fecha",
      )
      .order("fecha", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (serial) {
      query = query.eq("serial", serial);
    } else if (productoId) {
      query = query.eq("producto_id", productoId);
    }

    const { data, error } = await query;

    if (error) throw error;

    const batch = (data ?? []) as KardexRecord[];
    rows.push(...batch);

    if (batch.length < PAGE_SIZE) break;
  }

  return rows;
}

async function findProductById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select("id, sku, nombre")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data as ProductRecord | null;
}

async function findProductBySku(sku: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("productos")
    .select("id, sku, nombre")
    .eq("sku", sku)
    .maybeSingle();

  if (error) throw error;
  return data as ProductRecord | null;
}

function buildResult({
  mode,
  query,
  product,
  serial,
  movements,
}: {
  mode: InventoryMovementSearchMode;
  query: string;
  product: ProductRecord;
  serial: string | null;
  movements: InventoryKardexMovement[];
}): InventoryMovementSearchResult {
  return {
    mode,
    query,
    sku: product.sku,
    descripcion: product.nombre,
    serial,
    movements,
    total: movements.reduce(
      (sum, movement) => sum + movementDelta(movement),
      0,
    ),
  };
}

async function searchMovementsBySku(
  query: string,
): Promise<InventoryMovementSearchResponse> {
  const sku = query.trim().toUpperCase();
  const product = await findProductBySku(sku);

  if (!product) {
    return { status: "not-found", query };
  }

  const rows = await fetchMovements({ productoId: product.id });
  const individualMovements = rows.map((row) => mapMovement(row, product));
  const movements = consolidateSkuMovements(individualMovements);

  return {
    status: "found",
    result: buildResult({
      mode: "sku",
      query,
      product,
      serial: null,
      movements,
    }),
  };
}

async function searchMovementsByImei(
  query: string,
): Promise<InventoryMovementSearchResponse> {
  const serial = query.replace(/\s+/g, "").toUpperCase();
  const supabase = await createClient();
  const { data: serialMatch, error } = await supabase
    .from("inventory_serial_registry")
    .select("serial, producto_id")
    .eq("serial", serial)
    .maybeSingle();

  if (error) throw error;

  if (!serialMatch) {
    return { status: "not-found", query };
  }

  const product = await findProductById(serialMatch.producto_id);

  if (!product) {
    return {
      status: "error",
      query,
      message: "La serie existe, pero su producto asociado no está disponible.",
    };
  }

  const rows = await fetchMovements({ serial: serialMatch.serial });
  const movements = rows.map((row) => mapMovement(row, product));

  return {
    status: "found",
    result: buildResult({
      mode: "imei",
      query,
      product,
      serial: serialMatch.serial,
      movements,
    }),
  };
}

export async function searchInventoryMovements({
  mode,
  query: rawQuery,
}: SearchInput): Promise<InventoryMovementSearchResponse> {
  const query = rawQuery.trim();

  if (!query) {
    return { status: "not-found", query: "" };
  }

  try {
    return mode === "imei"
      ? await searchMovementsByImei(query)
      : await searchMovementsBySku(query);
  } catch {
    return {
      status: "error",
      query,
      message: "No se pudo consultar el Kardex. Intenta nuevamente.",
    };
  }
}
