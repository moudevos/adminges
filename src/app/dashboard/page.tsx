import { redirect } from "next/navigation";
import { InventoryManagement } from "@/components/dashboard/inventory-management";
import { ModuleContent } from "@/components/dashboard/module-content";
import { PersonalManagement } from "@/components/dashboard/personal-management";
import { AppShell } from "@/components/shell/app-shell";
import type { SnapshotHistoryRow } from "@/lib/inventory/types";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    module?: string;
    view?: string;
  }>;
};

type StockRow = {
  row_key: string;
  id: string;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  costo: number;
  precio: number;
  stock_minimo: number;
  is_active: boolean;
  cantidad_fisica: number;
  cantidad_disponible: number;
  stock_actual: number;
  valor_stock: number;
  series_count: number;
  almacen: string | null;
  ubicacion: string | null;
};

type MovementRow = {
  id: number;
  producto_id: string;
  tipo: string;
  direccion: string;
  cantidad: number;
  fecha: string;
};

type PuestoRow = {
  id: string;
  nombre: string;
};

type PersonaRow = {
  id: string;
  puesto_id: string;
  nombres: string;
  apellidos: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  is_active: boolean;
};

const modules = new Set([
  "inventario",
  "ventas",
  "cuotas",
  "personal",
  "herramientas",
]);

function defaultView(module: string) {
  if (module === "inventario") return "stock";
  if (module === "ventas") return "agregar";
  if (module === "cuotas") return "diaria";
  if (module === "herramientas") return "specs";
  return "";
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();

  if (error || !claimsData?.claims?.sub) {
    redirect("/login");
  }

  const params = await searchParams;
  const activeModule = modules.has(params.module ?? "")
    ? params.module!
    : "inventario";
  const activeView = params.view ?? defaultView(activeModule);

  let stock: StockRow[] = [];
  let movements: MovementRow[] = [];
  let snapshots: SnapshotHistoryRow[] = [];
  let puestos: PuestoRow[] = [];
  let personas: PersonaRow[] = [];

  if (activeModule === "inventario") {
    if (activeView === "cargar") {
      const { data } = await supabase
        .from("inventory_snapshots")
        .select(
          "id, snapshot_date, file_name, status, sku_count, unit_count, series_count, new_sku_count, exhausted_sku_count, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(30);

      snapshots = (data ?? []).map((row) => ({
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
    } else {
      const { data: stockData } = await supabase
        .from("inventario_stock")
        .select(
          "row_key, id, sku, nombre, marca, categoria, costo, precio, stock_minimo, is_active, cantidad_fisica, cantidad_disponible, stock_actual, valor_stock, series_count, almacen, ubicacion",
        )
        .eq("is_active", true)
        .gt("cantidad_fisica", 0)
        .order("nombre")
        .order("almacen")
        .order("ubicacion");

      stock = (stockData ?? []).map((row) => ({
        row_key: row.row_key,
        id: row.id,
        sku: row.sku,
        nombre: row.nombre,
        marca: row.marca,
        categoria: row.categoria,
        costo: Number(row.costo),
        precio: Number(row.precio),
        stock_minimo: Number(row.stock_minimo),
        is_active: Boolean(row.is_active),
        cantidad_fisica: Number(row.cantidad_fisica),
        cantidad_disponible: Number(row.cantidad_disponible),
        stock_actual: Number(row.stock_actual),
        valor_stock: Number(row.valor_stock),
        series_count: Number(row.series_count),
        almacen: row.almacen,
        ubicacion: row.ubicacion,
      }));

      if (activeView === "analisis") {
        const { data: movementData } = await supabase
          .from("inventario_kardex")
          .select("id, producto_id, tipo, direccion, cantidad, fecha")
          .order("fecha", { ascending: false })
          .order("id", { ascending: false })
          .limit(200);

        movements = (movementData ?? []).map((row) => ({
          id: Number(row.id),
          producto_id: row.producto_id,
          tipo: row.tipo,
          direccion: row.direccion,
          cantidad: Number(row.cantidad),
          fecha: row.fecha,
        }));
      }
    }
  }

  if (activeModule === "personal") {
    const [{ data: puestoData }, { data: personaData }] = await Promise.all([
      supabase
        .from("puestos")
        .select("id, nombre")
        .eq("is_active", true)
        .order("nombre"),
      supabase
        .from("personas")
        .select(
          "id, puesto_id, nombres, apellidos, documento, telefono, email, is_active",
        )
        .order("apellidos")
        .order("nombres"),
    ]);

    puestos = (puestoData ?? []).map((row) => ({
      id: row.id,
      nombre: row.nombre,
    }));

    personas = (personaData ?? []).map((row) => ({
      id: row.id,
      puesto_id: row.puesto_id,
      nombres: row.nombres,
      apellidos: row.apellidos,
      documento: row.documento,
      telefono: row.telefono,
      email: row.email,
      is_active: Boolean(row.is_active),
    }));
  }

  return (
    <AppShell
      email={
        typeof claimsData.claims.email === "string"
          ? claimsData.claims.email
          : "usuario"
      }
      activeModule={activeModule}
      activeView={activeView || undefined}
    >
      {activeModule === "inventario" ? (
        <InventoryManagement
          activeView={activeView}
          stock={stock}
          movements={movements}
          snapshots={snapshots}
        />
      ) : activeModule === "personal" ? (
        <PersonalManagement personas={personas} puestos={puestos} />
      ) : (
        <ModuleContent activeModule={activeModule} activeView={activeView} />
      )}
    </AppShell>
  );
}
