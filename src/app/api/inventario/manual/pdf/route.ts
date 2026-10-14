import { NextResponse } from "next/server";
import {
  loadManualInventory,
  loadManualInventoryLocations,
} from "@/features/inventario/server/manual-inventory";
import {
  generateManualInventoryPdf,
  type ManualPdfOrientation,
} from "@/features/inventario/server/manual-inventory-pdf";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) {
    return NextResponse.json({ message: "Sesión expirada." }, { status: 401 });
  }

  const params = new URL(request.url).searchParams;
  const warehouse = params.get("warehouse") ?? "";
  const location = params.get("location") ?? "";
  const orientation = params.get("orientation");

  if (orientation !== "landscape" && orientation !== "portrait") {
    return NextResponse.json(
      { message: "Selecciona orientación vertical u horizontal." },
      { status: 400 },
    );
  }
  if (!warehouse || !location) {
    return NextResponse.json(
      { message: "Selecciona el almacén para el conteo." },
      { status: 400 },
    );
  }

  try {
    const locations = await loadManualInventoryLocations();
    // Evita aceptar almacenes arbitrarios mediante parámetros manipulados.
    if (!locations.some(
      (option) => option.warehouse === warehouse && option.location === location,
    )) {
      return NextResponse.json(
        { message: "El almacén seleccionado no tiene inventario disponible." },
        { status: 404 },
      );
    }

    const stock = await loadManualInventory({ warehouse, location });
    if (stock.totalSkus === 0) {
      return NextResponse.json(
        { message: "No hay productos disponibles para generar el conteo." },
        { status: 404 },
      );
    }

    const pdf = generateManualInventoryPdf(
      stock,
      orientation as ManualPdfOrientation,
    );

    return new Response(pdf.bytes, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'inline; filename="inventario-manual-A4.pdf"',
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "X-Inventory-Max-Rows": String(pdf.maxRows),
        "X-Inventory-Min-Font-Size": pdf.minFontSize.toFixed(2),
      },
    });
  } catch {
    return NextResponse.json(
      { message: "No se pudo generar el PDF del conteo manual." },
      { status: 500 },
    );
  }
}
