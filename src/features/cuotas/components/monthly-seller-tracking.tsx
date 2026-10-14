import type { MonthlyCycleDetail } from "@/features/cuotas/domain/monthly-types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function percent(actual: number, target: number) {
  return target > 0 ? (actual / target) * 100 : 0;
}

function ratio(value: number | null) {
  return value === null ? "—" : value.toFixed(2) + "x";
}

export function MonthlySellerTracking({
  cycle,
}: {
  cycle: MonthlyCycleDetail;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Avance por vendedor</p>
        <p className="mt-1 text-xs text-slate-400">
          La cuota individual se reparte según días planificados.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1160px] text-left text-sm">
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Persona</th>
              <th className="border-b border-slate-200 px-4 py-3 text-center">Días</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">AMT</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">HHP FP</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">HHP MASS</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">TABS</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">ACC</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">SC+</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Láminas</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">AR</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">ECO</th>
            </tr>
          </thead>
          <tbody>
            {cycle.sellers.map((seller) => (
              <tr key={seller.id} className="border-t border-slate-100 first:border-t-0 hover:bg-slate-50/50">
                <td className="px-4 py-3.5">
                  <p className="font-medium text-slate-800">{seller.name}</p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {seller.role} · {seller.share.toFixed(2)}%
                  </p>
                </td>
                <td className="px-4 py-3.5 text-center tabular-nums text-slate-600">{seller.days}</td>
                <TargetActual target={seller.targets.amt} actual={seller.actuals.amt} />
                <TargetActual target={seller.targets.hhpFp} actual={seller.actuals.hhpFp} />
                <TargetActual target={seller.targets.hhpMass} actual={seller.actuals.hhpMass} />
                <TargetActual target={seller.targets.tabs} actual={seller.actuals.tabs} />
                <TargetActual target={seller.targets.acc} actual={seller.actuals.acc} />
                <TargetActual target={seller.targets.scPlus} actual={seller.actuals.scPlus} />
                <td className="px-4 py-3.5 text-right">
                  <p className="font-medium tabular-nums text-slate-700">
                    {seller.actuals.laminas} / {seller.targets.laminas}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {seller.targets.laminas > 0
                      ? percent(seller.actuals.laminas, seller.targets.laminas).toFixed(1) + "%"
                      : "—"}
                  </p>
                </td>
                <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">{ratio(seller.actuals.ar)}</td>
                <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-700">{ratio(seller.actuals.eco)}</td>
              </tr>
            ))}

            {cycle.sellers.length === 0 ? (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center text-sm text-slate-400">
                  El ciclo no tiene vendedores distribuidos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function TargetActual({
  target,
  actual,
}: {
  target: number;
  actual: number;
}) {
  return (
    <td className="px-4 py-3.5 text-right">
      <p className="font-medium tabular-nums text-slate-700">{money(actual)}</p>
      <p className="mt-0.5 text-[10px] tabular-nums text-slate-400">
        {money(target)} · {target > 0 ? percent(actual, target).toFixed(1) + "%" : "—"}
      </p>
    </td>
  );
}
