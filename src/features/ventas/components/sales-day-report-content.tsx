import type { ReactNode } from "react";
import type {
  SalesClosureBreakage,
  SalesClosureGroup,
  SalesClosureReport,
  SalesQuotas,
} from "@/features/ventas/domain/types";

// Orden del cierre comercial, de acuerdo con el formato del kiosko.
export const CLOSURE_REPORT_GROUPS: ReadonlyArray<{
  key: SalesClosureGroup;
  label: string;
}> = [
  { key: "HHP_SERIE_S", label: "HHP SERIE S" },
  { key: "HHP_SERIE_A", label: "HHP SERIE A" },
  { key: "HHP_SERIE_Z", label: "HHP SERIE Z" },
  { key: "TABLETS", label: "TABLETS" },
  { key: "LAMINAS", label: "LAMINAS" },
  { key: "WEA", label: "WEA" },
];

export const CLOSURE_TABLE_HEAD =
  "border border-[#c7d2e1] bg-[#edf2f7] px-3 py-2 text-center text-xs font-bold uppercase text-[#354761]";
export const CLOSURE_TABLE_CELL =
  "border border-[#c7d2e1] px-3 py-2 text-[13px] text-[#45546e]";

export function closureMoney(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function compliance(actual: number, target: number) {
  // Una cuota cero no tiene porcentaje de cumplimiento definido.
  return target > 0 ? ((actual / target) * 100).toFixed(2) + "%" : "—";
}

export function SalesDayReportMetrics({
  quotas,
  sales,
}: {
  quotas: SalesQuotas;
  sales: SalesQuotas;
}) {
  const metrics = [
    { label: "AMT", quota: quotas.amt, sale: sales.amt },
    { label: "SC+", quota: quotas.scPlus, sale: sales.scPlus },
    { label: "LAMINAS", quota: quotas.laminas, sale: sales.laminas },
  ];

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[600px] table-fixed border-collapse bg-white" aria-label="Resumen de cuotas y ventas">
        <thead>
          <tr>
            <th scope="col" className={CLOSURE_TABLE_HEAD} />
            <th scope="col" className={CLOSURE_TABLE_HEAD}>CUOTA</th>
            <th scope="col" className={CLOSURE_TABLE_HEAD}>VENTA</th>
            <th scope="col" className={CLOSURE_TABLE_HEAD}>% CUMPLIMIENTO</th>
          </tr>
        </thead>
        <tbody>
          {metrics.map((metric) => (
            <tr key={metric.label}>
              <th scope="row" className={CLOSURE_TABLE_CELL + " text-left font-semibold"}>
                {metric.label}
              </th>
              <td className={CLOSURE_TABLE_CELL + " text-center tabular-nums"}>
                {closureMoney(metric.quota)}
              </td>
              <td className={CLOSURE_TABLE_CELL + " text-center tabular-nums"}>
                {closureMoney(metric.sale)}
              </td>
              <td className={CLOSURE_TABLE_CELL + " text-center tabular-nums"}>
                {compliance(metric.sale, metric.quota)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SalesDayReportTableHeader() {
  return (
    <thead>
      <tr>
        <th scope="col" className={CLOSURE_TABLE_HEAD} />
        <th scope="col" className={CLOSURE_TABLE_HEAD}>VENTA UNID</th>
        <th scope="col" className={CLOSURE_TABLE_HEAD}>QUIEBRES</th>
        <th scope="col" className={CLOSURE_TABLE_HEAD}>DETALLE *No Color</th>
      </tr>
    </thead>
  );
}

export function SalesDayReportComments({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden border border-[#c7d2e1] bg-white">
      <h3 className="bg-[#203c87] px-3.5 py-2 text-[13px] font-bold uppercase text-white">
        COMENTARIOS - SUGERENCIAS
      </h3>
      {children}
    </section>
  );
}

export function SalesDayReportContent({
  report,
}: {
  report: SalesClosureReport;
}) {
  const breakages = new Map<SalesClosureGroup, SalesClosureBreakage>(
    report.breakages.map((item) => [item.group, item]),
  );

  const groups = CLOSURE_REPORT_GROUPS.filter(({ key }) => {
    if (key !== "WEA") return true;
    const wea = breakages.get("WEA");
    return Boolean(wea && (wea.units > 0 || wea.breakage || wea.detail?.trim()));
  });

  return (
    <div className="space-y-4">
      <SalesDayReportMetrics quotas={report.quotas} sales={report.sales} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] table-fixed border-collapse bg-white" aria-label="Ventas y quiebres por grupo">
          <SalesDayReportTableHeader />
          <tbody>
            {groups.map(({ key, label }) => {
              const item = breakages.get(key);
              return (
                <tr key={key}>
                  <th scope="row" className={CLOSURE_TABLE_CELL + " text-left font-medium"}>
                    {label}
                  </th>
                  <td className={CLOSURE_TABLE_CELL + " text-center tabular-nums"}>
                    {item?.units ?? 0}
                  </td>
                  <td className={CLOSURE_TABLE_CELL + " text-center"}>
                    {item?.breakage ? "SÍ" : "NO"}
                  </td>
                  <td className={CLOSURE_TABLE_CELL + " whitespace-pre-wrap break-words text-left"}>
                    {item?.detail ?? ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SalesDayReportComments>
        <p className="min-h-20 whitespace-pre-wrap break-words px-3.5 py-3 text-[13px] leading-5 text-[#4a5675]">
          {report.comments || "Sin comentarios registrados."}
        </p>
      </SalesDayReportComments>
    </div>
  );
}
