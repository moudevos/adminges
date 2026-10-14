"use client";

import type { InventoryStockRow } from "@/features/inventario/domain/types";
import type { InventoryMovementRow } from "@/features/inventario/server/loaders";

export function InventoryAnalysisView({
  stock,
  movements,
}: {
  stock: InventoryStockRow[];
  movements: InventoryMovementRow[];
}) {
  const products = new Set(stock.map((item) => item.sku)).size;
  const totalUnits = stock.reduce((sum, item) => sum + item.stockActual, 0);
  const totalValue = stock.reduce((sum, item) => sum + item.valorStock, 0);
  const belongsToStock = (warehouse: string | null, location: string | null) =>
    warehouse?.trim().toUpperCase() === "KIOSKO MALL IQUITOS - KIO37" &&
    location?.trim().toLowerCase() === "stock";
  const entrances = movements
    .filter((movement) =>
      belongsToStock(movement.almacen_destino, movement.ubicacion_destino))
    .reduce((sum, movement) => sum + movement.cantidad, 0);
  const exits = movements
    .filter((movement) =>
      belongsToStock(movement.almacen_origen, movement.ubicacion_origen))
    .reduce((sum, movement) => sum + movement.cantidad, 0);

  const productTotals = new Map<
    string,
    { id: string; nombre: string; stock: number }
  >();

  for (const item of stock) {
    const current = productTotals.get(item.sku);

    if (current) {
      current.stock += item.stockActual;
      continue;
    }

    productTotals.set(item.sku, {
      id: item.id,
      nombre: item.nombre,
      stock: item.stockActual,
    });
  }

  const top = [...productTotals.values()]
    .toSorted((a, b) => b.stock - a.stock)
    .slice(0, 6);
  const max = Math.max(1, ...top.map((item) => item.stock));

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-900">Solo ubicación <strong>Stock · KIO37</strong>. Se excluyen otras ubicaciones. Las transferencias hacia Stock son entradas y desde Stock son salidas; el Kardex es histórico.</p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Productos" value={String(products)} />
        <Metric label="Unidades operativas" value={String(totalUnits)} />
        <Metric label="Entradas a Stock" value={String(entrances)} />
        <Metric label="Salidas de Stock" value={String(exits)} />
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
            El análisis considera {movements.length} movimientos históricos asociados a Stock.
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
