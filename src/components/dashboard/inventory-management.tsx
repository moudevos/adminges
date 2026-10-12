"use client";

import { InventoryStockTable } from "@/components/dashboard/inventory-stock-table";
import { InventoryUploadView } from "@/components/dashboard/inventory-upload-view";
import type {
  InventoryStockRow,
  SnapshotHistoryRow,
} from "@/lib/inventory/types";

type MovementRow = {
  id: number;
  producto_id: string;
  tipo: string;
  direccion: string;
  cantidad: number;
  fecha: string;
};

type Props = {
  activeView: string;
  stock: InventoryStockRow[];
  movements: MovementRow[];
  snapshots: SnapshotHistoryRow[];
};

export function InventoryManagement({
  activeView,
  stock,
  movements,
  snapshots,
}: Props) {
  if (activeView === "cargar") {
    return <InventoryUploadView history={snapshots} />;
  }

  if (activeView === "analisis") {
    return <AnalysisView stock={stock} movements={movements} />;
  }

  return <InventoryStockTable rows={stock} />;
}

function AnalysisView({
  stock,
  movements,
}: {
  stock: InventoryStockRow[];
  movements: MovementRow[];
}) {
  const products = new Set(stock.map((item) => item.sku)).size;
  const totalUnits = stock.reduce((sum, item) => sum + item.stockActual, 0);
  const totalValue = stock.reduce((sum, item) => sum + item.valorStock, 0);
  const entrances = movements
    .filter((movement) => movement.direccion === "entrada")
    .reduce((sum, movement) => sum + movement.cantidad, 0);
  const exits = movements
    .filter((movement) => movement.direccion === "salida")
    .reduce((sum, movement) => sum + movement.cantidad, 0);

  const productTotals = new Map<
    string,
    { id: string; nombre: string; stock: number }
  >();

  for (const item of stock) {
    const current = productTotals.get(item.sku);
    if (current) {
      current.stock += item.stockActual;
    } else {
      productTotals.set(item.sku, {
        id: item.id,
        nombre: item.nombre,
        stock: item.stockActual,
      });
    }
  }

  const top = [...productTotals.values()]
    .toSorted((a, b) => b.stock - a.stock)
    .slice(0, 6);
  const max = Math.max(1, ...top.map((item) => item.stock));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Productos" value={String(products)} />
        <Metric label="Unidades operativas" value={String(totalUnits)} />
        <Metric label="Entradas Kardex" value={String(entrances)} />
        <Metric label="Salidas Kardex" value={String(exits)} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Productos con mayor stock operativo
          </h2>

          <div className="mt-5 space-y-4">
            {top.map((item) => (
              <div key={item.id}>
                <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
                  <span className="truncate font-medium text-slate-700">
                    {item.nombre}
                  </span>
                  <span className="font-semibold text-slate-900">
                    {item.stock}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{
                      width:
                        String(Math.max(4, (item.stock / max) * 100)) + "%",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Valor del stock operativo
          </p>
          <p className="mt-3 text-2xl font-semibold text-slate-900">
            {money(totalValue)}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            El Kardex conserva {movements.length} movimientos recientes.
          </p>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
        {value}
      </p>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}
