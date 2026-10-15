import type { CommercialIntelligence } from "@/features/inteligencia/server/loaders";
import { pen } from "@/features/inteligencia/components/period-filter";

const COVERAGES = [
  { key: "TR", title: "Todo riesgo" },
  { key: "ROBO", title: "Solo robo" },
  { key: "PANTALLA", title: "Daño de pantalla" },
  { key: "DANOS", title: "Pantalla e ingreso de líquidos" },
];

export function SCPlusCommissionReport({
  data,
}: {
  data: CommercialIntelligence;
}) {
  if (!data.scPlusCatalogAvailable) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        Aplica el SQL 017 para mostrar los planes SC+ intangibles en comisiones.
      </p>
    );
  }

  const rows = data.scPlusBreakdown;
  const units = rows.reduce((sum, row) => sum + row.units, 0);
  const total = rows.reduce((sum, row) => sum + row.sales, 0);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">
        SC+ · seguros vendidos por cobertura, vigencia y escala
      </h2>
      <p className="mt-1 text-xs leading-5 text-slate-500">
        {rows.length} SKU configurados · {units} planes vendidos · {pen(total)} facturados.
        SC+ es intangible: no requiere stock ni IMEI de almacén.
        Los precios se registran al vender, no se calculan con el rango del equipo.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {COVERAGES.map((coverage) => {
          const subset = rows.filter((row) => row.coverage === coverage.key);
          return (
            <article key={coverage.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-600">{coverage.title}</p>
              <p className="mt-2 text-lg font-semibold text-slate-950">
                {pen(subset.reduce((sum, row) => sum + row.sales, 0))}
              </p>
              <p className="text-xs text-slate-500">
                {subset.reduce((sum, row) => sum + row.units, 0)} planes
              </p>
            </article>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        {COVERAGES.flatMap((coverage) => [1, 2].map((years) => {
          const subset = rows.filter((row) =>
            row.coverage === coverage.key && row.years === years,
          ).sort((a, b) => a.tier - b.tier);
          const quantity = subset.reduce((sum, row) => sum + row.units, 0);
          const amount = subset.reduce((sum, row) => sum + row.sales, 0);
          return (
            <details key={coverage.key + years} className="overflow-hidden rounded-lg border border-slate-200">
              <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-medium text-slate-800">
                {coverage.title} · {years} {years === 1 ? "año" : "años"} ·
                {" "}{quantity} planes · {pen(amount)}
              </summary>
              <div className="overflow-x-auto p-3">
                <table className="w-full min-w-[520px] text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="p-2 text-left">SKU SC+</th>
                      <th className="p-2 text-right">Escala</th>
                      <th className="p-2 text-right">Precio etiqueta equipo</th>
                      <th className="p-2 text-right">Und.</th>
                      <th className="p-2 text-right">Venta SC+</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subset.map((row) => (
                      <tr key={row.sku} className="border-t border-slate-100">
                        <th className="p-2 text-left font-semibold">{row.sku}</th>
                        <td className="p-2 text-right">{row.tier}</td>
                        <td className="p-2 text-right">
                          {pen(row.labelMin)} – {pen(row.labelMax)}
                        </td>
                        <td className="p-2 text-right tabular-nums">{row.units}</td>
                        <td className="p-2 text-right tabular-nums">{pen(row.sales)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          );
        }))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Este desglose alimenta el cumplimiento de la caja SC+ (10% de peso).
        Solo se incluyen ventas confirmadas dentro del ciclo comercial.
      </p>
    </section>
  );
}
