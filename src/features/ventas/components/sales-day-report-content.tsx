import type {
  SalesClosureBreakage,
  SalesClosureReport,
} from "@/features/ventas/domain/types";

const LABELS: Record<SalesClosureBreakage["group"], string> = {
  HHP_SERIE_S: "HHP SERIE S",
  HHP_SERIE_A: "HHP SERIE A",
  HHP_SERIE_Z: "HHP SERIE Z",
  TABLETS: "TABLETS",
  WEA: "WEA",
  LAMINAS: "LÁMINAS",
};

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function percent(actual: number, target: number) {
  return target > 0 ? (actual / target) * 100 : 0;
}

export function SalesDayReportContent({
  report,
}: {
  report: SalesClosureReport;
}) {
  const metrics = [
    {
      label: "AMT",
      quota: money(report.quotas.amt),
      sale: money(report.sales.amt),
      percent: percent(report.sales.amt, report.quotas.amt),
    },
    {
      label: "SC+",
      quota: money(report.quotas.scPlus),
      sale: money(report.sales.scPlus),
      percent: percent(report.sales.scPlus, report.quotas.scPlus),
    },
    {
      label: "LÁMINAS",
      quota: money(report.quotas.laminas),
      sale: money(report.sales.laminas),
      percent: percent(report.sales.laminas, report.quotas.laminas),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left" />
              <th className="px-4 py-3 text-center">Cuota</th>
              <th className="px-4 py-3 text-center">Venta</th>
              <th className="px-4 py-3 text-center">% Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.label} className="border-t border-slate-100">
                <td className="px-4 py-3 font-semibold text-slate-700">
                  {metric.label}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                  {metric.quota}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                  {metric.sale}
                </td>
                <td className="px-4 py-3 text-center font-semibold tabular-nums text-slate-800">
                  {metric.percent.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[620px] text-sm">
          <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left" />
              <th className="px-4 py-3 text-center">Venta unid.</th>
              <th className="px-4 py-3 text-center">Quiebres</th>
              <th className="px-4 py-3 text-left">Detalle / Nº Color</th>
            </tr>
          </thead>
          <tbody>
            {report.breakages.map((item) => (
              <tr key={item.group} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-700">
                  {LABELS[item.group]}
                </td>
                <td className="px-4 py-3 text-center tabular-nums">
                  {item.units}
                </td>
                <td className="px-4 py-3 text-center font-semibold">
                  {item.breakage ? "SÍ" : "NO"}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {item.detail || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="rounded-xl border border-slate-200">
        <div className="border-b border-slate-200 bg-slate-900 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-white">
          Comentarios - sugerencias
        </div>
        <p className="min-h-20 px-4 py-3 text-sm leading-6 text-slate-600">
          {report.comments || "Sin comentarios registrados."}
        </p>
      </section>
    </div>
  );
}
