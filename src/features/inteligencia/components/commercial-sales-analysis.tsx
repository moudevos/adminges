import { PeriodFilter, MetricCard, pen, pct, Unavailable } from "./period-filter";
import type { CommercialIntelligence } from "@/features/inteligencia/server/loaders";

const GROUP_NAMES: Record<string, string> = {
  HHP_FP: "HHP Premium",
  HHP_MASS: "HHP Otros",
  TABS: "Tablets",
  ACC: "Accesorios",
  "SC+": "SC+",
  LAMINAS: "Láminas",
  OTROS: "Otros",
};

export function CommercialSalesAnalysis({ data }: { data: CommercialIntelligence }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Análisis de ventas y productos</h1>
        <p className="mt-1 text-sm text-slate-500">
          Avance comercial, rotación por producto y unidades estimadas para alcanzar la cuota.
        </p>
      </div>
      <PeriodFilter data={data} path="/ventas/analisis" />
      {!data.schemaReady || !data.cycle || !data.general ? (
        <Unavailable data={data} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Cuota AMT" value={pen(data.general.targets.amt)} />
            <MetricCard label="Venta AMT real" value={pen(data.general.actual.amt)} />
            <MetricCard label="Saldo para cumplir" value={pen(data.general.remaining.amt)} />
            <MetricCard label="Cumplimiento real" value={pct(data.general.targets.amt > 0
              ? data.general.actual.amt / data.general.targets.amt * 100 : null)} />
          </div>

          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 font-semibold text-slate-900">Brechas comerciales y stock disponible</h2>
            <p className="mb-4 text-xs text-slate-500">
              Unidades equivalentes estimadas con el último precio de venta confirmado por producto
              (o precio de catálogo si aún no registra venta), ponderado por stock disponible en Stock.
              No son una combinación exacta de productos.
            </p>
            <table className="w-full min-w-[710px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Indicador</th><th className="p-3 text-right">Cuota</th>
                  <th className="p-3 text-right">Venta</th><th className="p-3 text-right">Falta</th>
                  <th className="p-3 text-right">Precio referencia</th>
                  <th className="p-3 text-right">Unidades estimadas</th>
                  <th className="p-3 text-right">Stock (und.)</th></tr>
              </thead>
              <tbody>
                {data.opportunities.map((entry) => (
                  <tr key={entry.key} className="border-t border-slate-100">
                    <th scope="row" className="p-3 text-left font-semibold text-slate-700">{entry.title}</th>
                    <td className="p-3 text-right tabular-nums">{pen(entry.target)}</td>
                    <td className="p-3 text-right tabular-nums">{pen(entry.actual)}</td>
                    <td className="p-3 text-right tabular-nums">{pen(entry.shortfall)}</td>
                    <td className="p-3 text-right tabular-nums">{entry.meanSuggestedPrice !== null
                      ? pen(entry.meanSuggestedPrice) : "Sin precio"}</td>
                    <td className="p-3 text-right font-semibold tabular-nums">{entry.estimatedUnits ?? "—"}</td>
                    <td className="p-3 text-right tabular-nums">{entry.stockUnits}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-2 font-semibold text-slate-900">Comportamiento de productos</h2>
            <p className="mb-4 text-xs text-slate-500">
              Productos del ciclo, incluidos agotados. Stock = únicamente ubicación Stock del kiosko.
              El precio de referencia corresponde a la última venta confirmada cuando existe.
            </p>
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">SKU · Producto</th><th className="p-3">Familia</th>
                <th className="p-3 text-right">Und. vendidas</th>
                <th className="p-3 text-right">Ingresos</th>
                <th className="p-3 text-right">Stock</th>
                <th className="p-3 text-right">Último precio sugerido</th></tr>
              </thead>
              <tbody>
                {data.products.map((product) => (
                  <tr key={product.id} className="border-t border-slate-100">
                    <th scope="row" className="max-w-72 p-3 text-left">
                      <span className="block text-xs font-semibold text-indigo-700">{product.sku}</span>
                      <span className="block text-xs font-normal text-slate-600">{product.name}</span>
                    </th>
                    <td className="p-3 text-xs text-slate-500">{GROUP_NAMES[product.group] ?? product.group}</td>
                    <td className="p-3 text-right">{product.unitsSold}</td>
                    <td className="p-3 text-right tabular-nums">{pen(product.amountSold)}</td>
                    <td className="p-3 text-right">{product.remainingStock}</td>
                    <td className="p-3 text-right">{product.referencePrice !== null
                      ? pen(product.referencePrice) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.products.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No se registran productos con stock o ventas.</p>
            ) : null}
          </section>
          <p className="text-xs text-slate-500">
            SC+ y Láminas pueden contabilizarse además de AMT como indicadores separados.
            Los productos sin existencias no cuentan como cobertura disponible.
          </p>
        </>
      )}
    </div>
  );
}
