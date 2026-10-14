import {
  type CommissionResult,
} from "@/features/inteligencia/domain/projection";
import type { CommercialIntelligence } from "@/features/inteligencia/server/loaders";
import { PeriodFilter, MetricCard, pen, pct, Unavailable } from "./period-filter";

function CommissionTable({
  result, title, description,
}: {
  result: CommissionResult;
  title: string;
  description: string;
}) {
  return (
    <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 mb-4 text-xs leading-5 text-slate-500">{description}</p>
      <table className="w-full min-w-[580px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
          <tr>
            <th className="p-3 text-left">Caja / indicador</th>
            <th className="p-3 text-right">Peso</th>
            <th className="p-3 text-right">Cumplimiento</th>
            <th className="p-3 text-right">Aplicado (0–140%)</th>
            <th className="p-3 text-right">Aporte ponderado</th>
            <th className="p-3 text-right">Monto referencial</th>
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row) => (
            <tr key={row.key} className="border-t border-slate-100">
              <th className="p-3 text-left font-semibold text-slate-800">{row.label}</th>
              <td className="p-3 text-right">{row.weight}%</td>
              <td className="p-3 text-right">{pct(row.raw)}</td>
              <td className="p-3 text-right">{pct(row.effective)}</td>
              <td className="p-3 text-right font-semibold">{pct(row.points)}</td>
              <td className="p-3 text-right">{pen(row.referenceCash)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-200 bg-indigo-50 font-semibold text-indigo-900">
            <th scope="row" className="p-3 text-left">Ponderado conocido (parcial)</th>
            <td className="p-3 text-right">100%</td>
            <td colSpan={2} className="p-3 text-center">Sin liquidar</td>
            <td className="p-3 text-right">{pct(result.knownPoints)}</td>
            <td className="p-3 text-right">{pen(result.cashBase)}</td>
          </tr>
        </tbody>
      </table>
      {result.incomplete ? (
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Resultado incompleto: falta una cuota válida o el denominador de algún indicador.
          No se calcula la comisión final ni el pago individual.
        </p>
      ) : null}
    </section>
  );
}

export function CommissionsView({ data }: { data: CommercialIntelligence }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-950">Comisiones · cálculo automático</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pesos del cuadro SEP 2026, con un mínimo de 70% para activar cada caja y un tope de 140%.
        </p>
      </div>
      <PeriodFilter data={data} path="/comisiones" />
      {!data.schemaReady || !data.cycle || !data.general ||
        !data.commission || !data.projectedCommission ? (
        <Unavailable data={data} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Avance general AMT" value={pct(data.general.targets.amt > 0
              ? data.general.actual.amt / data.general.targets.amt * 100 : null)} />
            <MetricCard label="Ponderación conocida · actual" value={pct(data.commission.knownPoints)}
              caption="Parcial: no representa comisión liquidable" />
            <MetricCard label="Ponderación · simulación" value={pct(data.projectedCommission.knownPoints)}
              caption="Pronóstico de cierre · puede quedar incompleto" />
            <MetricCard label="Trade-in HHP FP" value={data.commission.tradeIn.actualUnits + " / " + data.commission.tradeIn.targetUnits + " und."}
              caption={"Penetración sobre HHP FP: " + pct(data.commission.tradeIn.penetrationPct)} />
          </div>
          <CommissionTable
            result={data.commission}
            title="Cuadro de comisiones · avance real"
            description="Se calcula con ventas confirmadas del ciclo; ponderación por caja, no porcentaje del sueldo."
          />
          <CommissionTable
            result={data.projectedCommission}
            title="Simulador automático · cierre estimado"
            description={"Aplica el modelo " + (data.model === "lineal" ? "lineal" : "plano") +
              " a importes y a unidades Trade-in; ECO permanece observado hasta contar con un modelo de ratios."}
          />
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-1 font-semibold text-slate-900">Personal activo · avance por caja</h2>
            <p className="mb-4 text-xs text-slate-500">
              La salida de una persona no modifica el resultado global ni redistribuye cuotas asignadas.
            </p>
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Promotor</th><th className="p-3 text-right">AMT real</th>
                  <th className="p-3 text-right">Cuota AMT</th>
                  <th className="p-3 text-right">Ponderado parcial</th>
                  <th className="p-3 text-right">Ponderado simulado</th></tr>
              </thead>
              <tbody>
                {data.sellers.map((seller) => (
                  <tr key={seller.id} className="border-t border-slate-100">
                    <th scope="row" className="p-3 text-left font-medium text-slate-800">{seller.name}</th>
                    <td className="p-3 text-right">{pen(seller.forecast.actual.amt)}</td>
                    <td className="p-3 text-right">{pen(seller.forecast.targets.amt)}</td>
                    <td className="p-3 text-right">{pct(seller.commission.knownPoints)}</td>
                    <td className="p-3 text-right">{pct(seller.projectedCommission.knownPoints)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Comisiones por indicador y promotor</h2>
            <div className="space-y-2">
              {data.sellers.map((seller) => (
                <details key={seller.id} className="rounded-lg border border-slate-200">
                  <summary className="cursor-pointer bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900">
                    {seller.name} · Ponderado conocido {pct(seller.commission.knownPoints)}
                    {" · "}Simulado {pct(seller.projectedCommission.knownPoints)}
                  </summary>
                  <div className="overflow-x-auto p-3">
                    <table className="w-full min-w-[480px] text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr><th className="p-2 text-left">Caja</th><th className="p-2 text-right">Peso</th>
                          <th className="p-2 text-right">Cumplimiento real</th>
                          <th className="p-2 text-right">Puntos reales</th>
                          <th className="p-2 text-right">Puntos simulados</th></tr>
                      </thead>
                      <tbody>
                        {seller.commission.rows.map((row, index) => (
                          <tr key={row.key} className="border-t border-slate-100">
                            <th className="p-2 text-left font-semibold">{row.label}</th>
                            <td className="p-2 text-right">{row.weight}%</td>
                            <td className="p-2 text-right">{pct(row.raw)}</td>
                            <td className="p-2 text-right">{pct(row.points)}</td>
                            <td className="p-2 text-right">
                              {pct(seller.projectedCommission.rows[index]?.points ?? null)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </details>
              ))}
            </div>
          </section>
          <p className="text-xs leading-5 text-slate-500">
            Trade-in: cuota en unidades HHP FP; se cuenta si la venta incluye el método de pago Trade-in, incluso en pagos mixtos. Penetración = HHP FP con Trade-in / todos los HHP FP vendidos. Cumplimiento de caja = unidades con Trade-in / cuota en unidades. «Monto de caja» toma S/ 650 como BASE REFERENCIAL del cuadro compartido
            (35%, 27%, 5%, 13%, 5%, 5%, 10%). No equivale a pago ganado.
            Fórmula de liquidación monetaria y registro de Trade-in pendientes de validación.
          </p>
        </>
      )}
    </div>
  );
}
