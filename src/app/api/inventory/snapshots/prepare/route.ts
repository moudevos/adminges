import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { parseInventoryWorkbook } from "@/lib/inventory/parser";
import { normalizeInventoryRows } from "@/lib/inventory/normalize";
import { summarizeSnapshot } from "@/lib/inventory/reconcile";
import type {
  ComparableInventoryRow,
  InventoryValidationError,
  NormalizedInventoryRow,
} from "@/lib/inventory/types";
import {
  validateInventoryRows,
  validateSerializationAgainstCurrent,
} from "@/lib/inventory/validate";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const acceptedExtensions = [".xlsx", ".xls", ".csv"];

function safeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .slice(0, 180);
}

function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value + "T00:00:00Z"))
  );
}

async function fetchCurrentRows(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data: snapshot, error: snapshotError } = await supabase
    .from("inventory_snapshots")
    .select("id")
    .eq("status", "applied")
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError) throw snapshotError;
  if (!snapshot) return [] as ComparableInventoryRow[];

  const rows: ComparableInventoryRow[] = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("inventory_snapshot_items")
      .select(
        "sku, serial, cantidad_fisica, cantidad_disponible, cantidad_operativa, almacen, ubicacion",
      )
      .eq("snapshot_id", snapshot.id)
      .range(from, from + pageSize - 1);

    if (error) throw error;

    const batch = (data ?? []).map((row) => ({
      sku: row.sku,
      serial: row.serial,
      cantidadFisica: Number(row.cantidad_fisica),
      cantidadDisponible: Number(row.cantidad_disponible),
      cantidadOperativa: Number(row.cantidad_operativa),
      almacen: row.almacen,
      ubicacion: row.ubicacion,
    }));

    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  return rows;
}

async function validateRegistry(
  supabase: Awaited<ReturnType<typeof createClient>>,
  rows: NormalizedInventoryRow[],
) {
  const errors: InventoryValidationError[] = [];
  const serialRows = rows.filter((row) => row.serial);
  const serials = serialRows.map((row) => row.serial as string);
  const bySerial = new Map(
    serialRows.map((row) => [row.serial as string, row]),
  );

  for (let index = 0; index < serials.length; index += 200) {
    const batch = serials.slice(index, index + 200);
    const { data, error } = await supabase
      .from("inventory_serial_registry")
      .select("serial, sku")
      .in("serial", batch);

    if (error) throw error;

    for (const registered of data ?? []) {
      const candidate = bySerial.get(registered.serial);
      if (candidate && candidate.sku !== registered.sku) {
        errors.push({
          row: candidate.rowNumber,
          code: "SERIAL_SKU_CONFLICT",
          message:
            "La serie " +
            registered.serial +
            " pertenece históricamente al SKU " +
            registered.sku +
            " y ahora aparece como " +
            candidate.sku +
            ".",
          sku: candidate.sku,
          serial: registered.serial,
        });
      }
    }
  }

  return errors;
}

async function insertItems(
  supabase: Awaited<ReturnType<typeof createClient>>,
  snapshotId: string,
  rows: NormalizedInventoryRow[],
) {
  for (let index = 0; index < rows.length; index += 500) {
    const batch = rows.slice(index, index + 500).map((row) => ({
      snapshot_id: snapshotId,
      row_number: row.rowNumber,
      sku: row.sku,
      serial: row.serial,
      descripcion_original: row.descripcionOriginal,
      descripcion: row.descripcion,
      cantidad_fisica: row.cantidadFisica,
      cantidad_disponible: row.cantidadDisponible,
      cantidad_operativa: row.cantidadOperativa,
      almacen: row.almacen,
      ubicacion: row.ubicacion,
      categoria_original: row.categoriaOriginal,
      categoria_principal: row.categoriaPrincipal,
      categoria_venta: row.categoriaVenta,
      familia: row.familia,
      variante: row.variante,
    }));

    const { error } = await supabase
      .from("inventory_snapshot_items")
      .insert(batch);

    if (error) throw error;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: claims, error: authError } = await supabase.auth.getClaims();

  if (authError || !claims?.claims?.sub) {
    return NextResponse.json({ message: "Sesión expirada." }, { status: 401 });
  }

  const formData = await request.formData();
  const fileValue = formData.get("file");
  const snapshotDate = String(formData.get("snapshotDate") ?? "");

  if (!(fileValue instanceof File)) {
    return NextResponse.json(
      { message: "Adjunta un archivo de inventario." },
      { status: 400 },
    );
  }

  if (!validDate(snapshotDate)) {
    return NextResponse.json(
      { message: "Selecciona una fecha válida para el snapshot." },
      { status: 400 },
    );
  }

  if (fileValue.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { message: "El archivo supera el límite de 10 MB." },
      { status: 413 },
    );
  }

  const lowerName = fileValue.name.toLowerCase();
  if (!acceptedExtensions.some((extension) => lowerName.endsWith(extension))) {
    return NextResponse.json(
      { message: "Usa un archivo XLSX, XLS o CSV." },
      { status: 400 },
    );
  }

  const snapshotId = randomUUID();
  const fileName = safeFileName(fileValue.name) || "inventario.xlsx";
  const storagePath =
    snapshotDate + "/" + snapshotId + "/" + fileName;
  const buffer = await fileValue.arrayBuffer();

  const { error: uploadError } = await supabase.storage
    .from("inventory-snapshots")
    .upload(storagePath, buffer, {
      contentType: fileValue.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) {
    return NextResponse.json(
      {
        message:
          "No se pudo guardar el archivo. Verifica que SQL 002 esté aplicado.",
      },
      { status: 500 },
    );
  }

  const parsed = parseInventoryWorkbook(buffer);
  const normalized = normalizeInventoryRows(parsed.rows);
  let errors: InventoryValidationError[] = [
    ...parsed.errors,
    ...normalized.errors,
    ...validateInventoryRows(normalized.rows),
  ];

  let currentRows: ComparableInventoryRow[] = [];

  try {
    currentRows = await fetchCurrentRows(supabase);

    if (errors.length === 0) {
      errors = [
        ...errors,
        ...validateSerializationAgainstCurrent(normalized.rows, currentRows),
        ...(await validateRegistry(supabase, normalized.rows)),
      ];
    }
  } catch {
    return NextResponse.json(
      {
        message:
          "No se pudo consultar el inventario actual. Verifica que SQL 002 esté aplicado.",
      },
      { status: 500 },
    );
  }

  const summary = summarizeSnapshot(currentRows, normalized.rows);
  const snapshotPayload = {
    id: snapshotId,
    snapshot_date: snapshotDate,
    file_name: fileValue.name,
    storage_path: storagePath,
    mime_type: fileValue.type || null,
    file_size: fileValue.size,
    status: errors.length > 0 ? "error" : "validated",
    sku_count: summary.candidate.skuCount,
    unit_count: summary.candidate.units,
    series_count: summary.candidate.series,
    new_sku_count: summary.newSkus,
    exhausted_sku_count: summary.exhaustedSkus,
    previous_sku_count: summary.current.skuCount,
    previous_unit_count: summary.current.units,
    sku_difference: summary.difference.skuCount,
    unit_difference: summary.difference.units,
    location_summary: summary.locations,
    validation_errors: errors,
  };

  const { error: snapshotError } = await supabase
    .from("inventory_snapshots")
    .insert(snapshotPayload);

  if (snapshotError) {
    return NextResponse.json(
      {
        message:
          "No se pudo registrar el snapshot. Verifica que SQL 002 esté aplicado.",
      },
      { status: 500 },
    );
  }

  if (errors.length > 0) {
    return NextResponse.json(
      {
        message:
          "El archivo contiene errores críticos y no puede actualizar el inventario.",
        errors: errors.slice(0, 50),
      },
      { status: 422 },
    );
  }

  try {
    await insertItems(supabase, snapshotId, normalized.rows);
  } catch {
    await supabase
      .from("inventory_snapshots")
      .update({
        status: "error",
        validation_errors: [
          {
            row: null,
            code: "ITEM_INSERT_FAILED",
            message: "No se pudieron guardar las filas normalizadas.",
          },
        ],
      })
      .eq("id", snapshotId);

    return NextResponse.json(
      { message: "No se pudieron guardar las filas del snapshot." },
      { status: 500 },
    );
  }

  await supabase
    .from("inventory_snapshots")
    .update({ status: "superseded" })
    .eq("snapshot_date", snapshotDate)
    .neq("id", snapshotId)
    .in("status", ["validated", "error"]);

  return NextResponse.json({
    snapshot: {
      id: snapshotId,
      snapshotDate,
      fileName: fileValue.name,
      ...summary,
    },
  });
}
