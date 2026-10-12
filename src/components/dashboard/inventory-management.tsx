"use client";

import { InventoryUploadView } from "@/components/dashboard/inventory-upload-view";
import type { SnapshotHistoryRow } from "@/lib/inventory/types";

type StockRow = {
  id: string;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  costo: number;
  precio: number;
  stock_minimo: number;
  is_active: boolean;
  stock_actual: number;
  valor_stock: number;
  almacen?: string | null;
  ubicacion?: string | null;
};

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
  stock: StockRow[];
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

  return <StockView stock={stock} />;
}

function StockView({ stock }: { stock: StockRow[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">Stock actual</h2>
        <p className="mt-1 text-xs text-slate-500">
          Stock operativo: disponible en KIOSKO MALL IQUITOS - KIO37 / Stock.
        </p>
      </div>

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="text-xs font-semibold text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-3">SKU</th>
              <th className="border-b border-slate-200 px-3 py-3">Producto</th>
              <th className="border-b border-slate-200 px-3 py-3">Categoría</th>
              <th className="border-b border-slate-200 px-3 py-3">Ubicación</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right">
                Cantidad
              </th>
            </tr>
          </thead>

          <tbody>
            {stock.map((item) => (
              <tr key={item.id} className="transition hover:bg-slate-50">
                <td className="border-b border-slate-100 px-3 py-3.5 font-mono text-xs font-semibold text-slate-500">
                  {item.sku}
                </td>
                <td className="border-b border-slate-100 px-3 py-3.5 font-medium text-slate-900">
                  {item.nombre}
                </td>
                <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                  {item.categoria || "—"}
                </td>
                <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                  {item.ubicacion || item.almacen || "—"}
                </td>
                <td className="border-b border-slate-100 px-3 py-3.5 text-right text-base font-semibold text-slate-900">
                  {item.stock_actual}
                </td>
              </tr>
            ))}

            {stock.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-5 py-10 text-center text-slate-400"
                >
                  Aún no hay un snapshot aplicado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalysisView({
  stock,
  movements,
}: {
  stock: StockRow[];
  movements: MovementRow[];
}) {
  const totalUnits = stock.reduce((sum, item) => sum + item.stock_actual, 0);
  const totalValue = stock.reduce((sum, item) => sum + item.valor_stock, 0);
  const entrances = movements
    .filter((movement) => movement.direccion === "entrada")
    .reduce((sum, movement) => sum + movement.cantidad, 0);
  const exits = movements
    .filter((movement) => movement.direccion === "salida")
    .reduce((sum, movement) => sum + movement.cantidad, 0);

  const top = stock
    .toSorted((a, b) => b.stock_actual - a.stock_actual)
    .slice(0, 6);
  const max = Math.max(1, ...top.map((item) => item.stock_actual));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Productos" value={String(stock.length)} />
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
                    {item.stock_actual}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-indigo-600"
                    style={{
                      width:
                        String(Math.max(4, (item.stock_actual / max) * 100)) +
                        "%",
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
