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
  LAMINAS: "LAMINAS",
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

const BORDER = "border border-[#c5d0e6]";
const HEAD = `${BORDER} bg-[#eef2fa] px-4 py-2.5 text-xs font-bold uppercase text-[#2d3a5a]`;
const CELL = `${BORDER} px-3 py-2 text-[13px] text-[#2d3a5a]`;

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
      label: "LAMINAS",
      quota: money(report.quotas.laminas),
      sale: money(report.sales.laminas),
      percent: percent(report.sales.laminas, report.quotas.laminas),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-0 overflow-hidden rounded-sm bg-white">
          <thead>
            <tr>
              <th className={`${HEAD} text-left`} />
              <th className={`${HEAD} text-center`}>Cuota</th>
              <th className={`${HEAD} text-center`}>Venta</th>
              <th className={`${HEAD} text-center`}>% Cumplimiento</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map((metric) => (
              <tr key={metric.label}>
                <td className={`${CELL} font-semibold`}>{metric.label}</td>
                <td className={`${CELL} text-center tabular-nums`}>
                  {metric.quota}
                </td>
                <td className={`${CELL} text-center tabular-nums`}>
                  {metric.sale}
                </td>
                <td className={`${CELL} text-center tabular-nums`}>
                  {metric.percent.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] table-fixed border-separate border-spacing-0 overflow-hidden rounded-sm bg-white">
          <thead>
            <tr>
              <th className={`${HEAD} text-left`} />
              <th className={`${HEAD} text-center`}>Venta unid</th>
              <th className={`${HEAD} text-center`}>Quiebres</th>
              <th className={`${HEAD} text-center`}>Detalle *No Color</th>
            </tr>
          </thead>
          <tbody>
            {report.breakages.map((item) => (
              <tr key={item.group}>
                <td className={`${CELL} font-semibold`}>
                  {LABELS[item.group]}
                </td>
                <td className={`${CELL} text-center tabular-nums`}>
                  {item.units}
                </td>
                <td className={`${CELL} text-center`}>
                  {item.breakage ? "SÍ" : "NO"}
                </td>
                <td className={`${CELL} text-left`}>{item.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="overflow-hidden rounded-sm border border-[#c5d0e6] bg-white">
        <div className="bg-[#1e3a8a] px-4 py-2.5 text-[13px] font-bold uppercase text-white">
          Comentarios - sugerencias
        </div>
        <p className="min-h-20 px-4 py-3 text-[13px] leading-6 text-[#4a5675]">
          {report.comments || "Sin comentarios registrados."}
        </p>
      </section>
    </div>
  );
}