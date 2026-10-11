import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { InventoryManagement } from "@/components/dashboard/inventory-management";
import { ModuleContent } from "@/components/dashboard/module-content";
import { PersonalManagement } from "@/components/dashboard/personal-management";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    module?: string;
    view?: string;
  }>;
};

type ProductRow = {
  id: string;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  costo: number;
  precio: number;
  stock_minimo: number;
  is_active: boolean;
};

type StockRow = ProductRow & {
  stock_actual: number;
  valor_stock: number;
};

type MovementRow = {
  id: number;
  producto_id: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number | null;
  referencia: string | null;
  nota: string | null;
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

const modules = new Set(["inventario", "ventas", "cuotas", "personal", "herramientas"]);

function defaultView(module: string) {
  if (module === "inventario") return "stock";
  if (module === "ventas") return "agregar";
  if (module === "cuotas") return "diaria";
  if (module === "herramientas") return "specs";
  return "";
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();

  if (error || !claimsData?.claims?.sub) {
    redirect("/login");
  }

  const params = await searchParams;
  const activeModule = modules.has(params.module ?? "") ? params.module! : "inventario";
  const activeView = params.view ?? defaultView(activeModule);

  let products: ProductRow[] = [];
  let stock: StockRow[] = [];
  let movements: MovementRow[] = [];
  let puestos: PuestoRow[] = [];
  let personas: PersonaRow[] = [];

  if (activeModule === "inventario") {
    const [{ data: productData }, { data: stockData }, { data: movementData }] = await Promise.all([
      supabase
        .from("productos")
        .select("id, sku, nombre, marca, categoria, costo, precio, stock_minimo, is_active")
        .eq("is_active", true)
        .order("nombre"),
      supabase
        .from("inventario_stock")
        .select("id, sku, nombre, marca, categoria, costo, precio, stock_minimo, is_active, stock_actual, valor_stock")
        .eq("is_active", true)
        .order("nombre"),
      supabase
        .from("inventario_movimientos")
        .select("id, producto_id, tipo, cantidad, costo_unitario, referencia, nota, fecha")
        .order("fecha", { ascending: false })
        .limit(100),
    ]);

    products = (productData ?? []).map((row) => ({
      id: row.id,
      sku: row.sku,
      nombre: row.nombre,
      marca: row.marca,
      categoria: row.categoria,
      costo: Number(row.costo),
      precio: Number(row.precio),
      stock_minimo: Number(row.stock_minimo),
      is_active: Boolean(row.is_active),
    }));

    stock = (stockData ?? []).map((row) => ({
      id: row.id,
      sku: row.sku,
      nombre: row.nombre,
      marca: row.marca,
      categoria: row.categoria,
      costo: Number(row.costo),
      precio: Number(row.precio),
      stock_minimo: Number(row.stock_minimo),
      is_active: Boolean(row.is_active),
      stock_actual: Number(row.stock_actual),
      valor_stock: Number(row.valor_stock),
    }));

    movements = (movementData ?? []).map((row) => ({
      id: Number(row.id),
      producto_id: row.producto_id,
      tipo: row.tipo,
      cantidad: Number(row.cantidad),
      costo_unitario: row.costo_unitario === null ? null : Number(row.costo_unitario),
      referencia: row.referencia,
      nota: row.nota,
      fecha: row.fecha,
    }));
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
        .select("id, puesto_id, nombres, apellidos, documento, telefono, email, is_active")
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
      email={typeof claimsData.claims.email === "string" ? claimsData.claims.email : "usuario"}
      activeModule={activeModule}
      activeView={activeView || undefined}
    >
      {activeModule === "inventario" ? (
        <InventoryManagement
          activeView={activeView}
          products={products}
          stock={stock}
          movements={movements}
        />
      ) : activeModule === "personal" ? (
        <PersonalManagement personas={personas} puestos={puestos} />
      ) : (
        <ModuleContent activeModule={activeModule} activeView={activeView} />
      )}
    </AppShell>
  );
}
