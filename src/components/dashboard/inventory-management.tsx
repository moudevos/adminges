"use client";

import { InventoryUploadView } from "@/components/dashboard/inventory-upload-view";
import { ModuleTabs } from "@/components/dashboard/module-tabs";

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

type Props = {
  activeView: string;
  products: ProductRow[];
  stock: StockRow[];
  movements: MovementRow[];
};

const tabs = [
  { key: "cargar", label: "Cargar" },
  { key: "stock", label: "Stock" },
  { key: "analisis", label: "Análisis" },
];

export function InventoryManagement({
  activeView,
  stock,
  movements,
}: Props) {
  const view = tabs.some((item) => item.key === activeView)
    ? activeView
    : "stock";

  return (
    <div className="space-y-4">
      <ModuleTabs module="inventario" tabs={tabs} active={view} />

      {view === "cargar" ? (
        <InventoryUploadView />
      ) : view === "analisis" ? (
        <AnalysisView stock={stock} movements={movements} />
      ) : (
        <StockView stock={stock} />
      )}
    </div>
  );
}

function StockView({ stock }: { stock: StockRow[] }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-[15px] font-semibold text-slate-900">Stock actual</h2>
        <p className="mt-1 text-xs text-slate-500">
          {stock.length} productos activos
        </p>
      </div>

      <div className="overflow-x-auto p-2">
        <table className="w-full min-w-[950px] text-left text-sm">
          <thead className="text-xs font-semibold text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-3 py-3">SKU</th>
              <th className="border-b border-slate-200 px-3 py-3">Producto</th>
              <th className="border-b border-slate-200 px-3 py-3">Categoría</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right">Stock</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right">Mínimo</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right">Costo</th>
              <th className="border-b border-slate-200 px-3 py-3 text-right">Valor</th>
              <th className="border-b border-slate-200 px-3 py-3">Estado</th>
            </tr>
          </thead>

          <tbody>
            {stock.map((item) => {
              const low = item.stock_actual <= item.stock_minimo;

              return (
                <tr key={item.id} className="transition hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-3.5 font-mono text-xs font-semibold text-slate-500">
                    {item.sku}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5">
                    <p className="font-medium text-slate-900">{item.nombre}</p>
                    <p className="text-xs text-slate-400">
                      {item.marca || "Sin marca"}
                    </p>
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                    {item.categoria || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-right text-base font-semibold text-slate-900">
                    {item.stock_actual}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-right text-slate-500">
                    {item.stock_minimo}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-right text-slate-600">
                    {money(item.costo)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-right font-medium text-slate-900">
                    {money(item.valor_stock)}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        low
                          ? "bg-amber-50 text-amber-700"
                          : "bg-emerald-50 text-emerald-700"
                      }`}
                    >
                      {low ? "Stock bajo" : "Disponible"}
                    </span>
                  </td>
                </tr>
              );
            })}

            {stock.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-10 text-center text-slate-400"
                >
                  Aún no hay productos en inventario.
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
  const lowStock = stock.filter(
    (item) => item.stock_actual <= item.stock_minimo,
  ).length;
  const loadedUnits = movements
    .filter((movement) => movement.tipo === "carga")
    .reduce((sum, movement) => sum + movement.cantidad, 0);

  const top = stock
    .toSorted((a, b) => b.stock_actual - a.stock_actual)
    .slice(0, 6);
  const max = Math.max(1, ...top.map((item) => item.stock_actual));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Productos" value={String(stock.length)} />
        <Metric label="Unidades en stock" value={String(totalUnits)} />
        <Metric label="Stock bajo" value={String(lowStock)} />
        <Metric label="Valor inventario" value={money(totalValue)} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-[15px] font-semibold text-slate-900">
            Productos con mayor stock
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
                      width: `${Math.max(4, (item.stock_actual / max) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {top.length === 0 ? (
              <p className="text-sm text-slate-400">Sin datos todavía.</p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Movimientos recientes
          </p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">
            {movements.length}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Últimos movimientos consultados.
          </p>

          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">
              Unidades cargadas en la muestra
            </p>
            <p className="mt-1 text-xl font-semibold text-slate-900">
              {loadedUnits}
            </p>
          </div>
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
