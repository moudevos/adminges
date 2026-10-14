import { MONEY_KEYS, MONEY_LABELS } from "@/features/inteligencia/domain/projection";
import type { CommercialIntelligence } from "@/features/inteligencia/server/loaders";
import { MetricCard, pen, pct, PeriodFilter, Unavailable } from "./period-filter";

function ForecastChart({
  data,
}: {
  data: CommercialIntelligence;
}) {
  if (!data.general || !data.cycle) return null;
  const { daily, projected, targets, elapsedDays, totalDays } = data.general;
  const max = Math.max(targets.amt, projected.amt, ...daily.map((x) => x.accumulated), 1);
  const xAt = (day: number) => 34 + (day / Math.max(totalDays, 1)) * 635;
  const yAt = (amount: number) => 176 - (amount / max) * 149;
  const history = [
    [xAt(0), yAt(0)],
    ...daily.map((day, index) => [xAt(index + 1), yAt(day.accumulated)]),
  ];
  const points = history.map((point) => point.join(",")).join(" ");
  const targetLine = "34," + yAt(0) + " " + xAt(totalDays) + "," + yAt(targets.amt);
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">Trayectoria de AMT · ciclo comercial</h2>
      <p className="mt-1 text-xs text-slate-500">
        Acumulado real (azul), cuota esperada proporcional (gris) y proyección (índigo punteado).
      </p>
      <svg viewBox="0 0 700 205" role="img" aria-label="Trayectoria acumulada de ventas frente a cuota y pronóstico" className="mt-4 h-auto w-full">
        <line x1="34" y1="176" x2="676" y2="176" stroke="#cbd5e1" />
        <line x1="34" y1="27" x2="34" y2="176" stroke="#cbd5e1" />
        <polyline fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="6 5" points={targetLine} />
        <polyline fill="none" stroke="#2563eb" strokeWidth="3" points={points} />
        {elapsedDays > 0 && elapsedDays < totalDays ? (
          <line x1={xAt(elapsedDays)} y1={yAt(data.general.actual.amt)}
            x2={xAt(totalDays)} y2={yAt(projected.amt)}
            stroke="#4f46e5" strokeWidth="3" strokeDasharray="6 4" />
        ) : null}
        <text x="34" y="198" fontSize="11" fill="#64748b">Inicio</text>
        <text x="675" y="198" textAnchor="end" fontSize="11" fill="#64748b">Fin del ciclo</text>
        <text x="40" y="20" fontSize="10" fill="#64748b">{pen(max)}</text>
      </svg>
    </section>
  );
}

export function ForecastView({ data }: { data: CommercialIntelligence }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">Predicción de ventas</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pronóstico del ciclo comercial y cuotas individuales a partir de las ventas confirmadas.
        </p>
      </div>
      <PeriodFilter data={data} path="/prediccion" />
      {!data.schemaReady || !data.cycle || !data.general ? (
        <Unavailable data={data} />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="Cuota general AMT" value={pen(data.general.targets.amt)} />
            <MetricCard label="Ventas a la fecha" value={pen(data.general.actual.amt)} />
            <MetricCard label="Cierre proyectado" value={pen(data.general.projected.amt)}
              caption={pct(data.general.targets.amt > 0 ? data.general.projected.amt / data.general.targets.amt * 100 : null) + " de cuota"} />
            <MetricCard label="Para cumplir" value={pen(data.general.remaining.amt)}
              caption={data.general.daysRemaining + " días comerciales restantes"} />
          </div>
          {data.general.elapsedDays === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Ciclo todavía no iniciado: la predicción no tiene observaciones.
            </p>
          ) : data.model === "lineal" && !data.general.trendAvailable ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Tendencia lineal requiere al menos 3 días transcurridos; se utiliza promedio plano provisional.
            </p>
          ) : null}
          <ForecastChart data={data} />
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-3 font-semibold text-slate-900">Pronóstico por indicador</h2>
            <table className="w-full min-w-[650px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Indicador</th><th className="p-3 text-right">Cuota</th>
                  <th className="p-3 text-right">Venta real</th><th className="p-3 text-right">Al cierre</th>
                  <th className="p-3 text-right">Diferencia a hoy</th></tr>
              </thead>
              <tbody>
                {MONEY_KEYS.map((key) => (
                  <tr key={key} className="border-t border-slate-100">
                    <th scope="row" className="p-3 text-left font-medium text-slate-800">{MONEY_LABELS[key]}</th>
                    <td className="p-3 text-right tabular-nums">{pen(data.general!.targets[key])}</td>
                    <td className="p-3 text-right tabular-nums">{pen(data.general!.actual[key])}</td>
                    <td className="p-3 text-right tabular-nums">{pen(data.general!.projected[key])}</td>
                    <td className="p-3 text-right tabular-nums">{pen(data.general!.remaining[key])}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="mb-1 font-semibold text-slate-900">Proyección individual · personal activo</h2>
            <p className="mb-3 text-xs text-slate-500">
              Las bajas no redistribuyen las metas históricas ni reducen los logros de la tienda.
            </p>
            <table className="w-full min-w-[620px] text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr><th className="p-3">Personal</th><th className="p-3 text-right">Cuota AMT</th>
                <th className="p-3 text-right">Real</th><th className="p-3 text-right">Proyectado</th>
                <th className="p-3 text-right">Cumplimiento final</th></tr>
              </thead>
              <tbody>
                {data.sellers.map((seller) => (
                  <tr key={seller.id} className="border-t border-slate-100">
                    <th scope="row" className="p-3 text-left text-slate-800">{seller.name}</th>
                    <td className="p-3 text-right">{pen(seller.forecast.targets.amt)}</td>
                    <td className="p-3 text-right">{pen(seller.forecast.actual.amt)}</td>
                    <td className="p-3 text-right">{pen(seller.forecast.projected.amt)}</td>
                    <td className="p-3 text-right">{pct(seller.forecast.targets.amt > 0
                      ? seller.forecast.projected.amt / seller.forecast.targets.amt * 100 : null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          <p className="text-xs leading-5 text-slate-500">
            Modelo plano: venta diaria media × días futuros. Modelo lineal: tendencia por mínimos
            cuadrados sobre venta diaria, incluyendo días sin ventas (pronóstico no negativo).
            El día actual puede estar incompleto. Son estimaciones, no garantías.
          </p>
        </>
      )}
    </div>
  );
}
