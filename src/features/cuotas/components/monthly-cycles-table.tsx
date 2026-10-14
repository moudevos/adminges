import Link from "next/link";
import type { MonthlyCycleSummary } from "@/features/cuotas/domain/monthly-types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function dateLabel(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? day + "/" + month + "/" + year : value;
}

export function MonthlyCyclesTable({
  cycles,
}: {
  cycles: MonthlyCycleSummary[];
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">Ciclos comerciales</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Ciclo</th>
              <th className="border-b border-slate-200 px-4 py-3 text-center">Semanas</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">AMT</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">SC+</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Láminas</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Jornadas-persona</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {cycles.map((cycle) => (
              <tr key={cycle.id} className="border-t border-slate-100 first:border-t-0 hover:bg-slate-50/60">
                <td className="px-4 py-3.5">
                  <p className="font-medium text-slate-800">
                    {dateLabel(cycle.startDate)} - {dateLabel(cycle.endDate)}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {cycle.commercialDays} días comerciales
                  </p>
                </td>
                <td className="px-4 py-3.5 text-center tabular-nums text-slate-600">
                  {cycle.weeks}
                </td>
                <td className="px-4 py-3.5 text-right font-medium tabular-nums text-slate-800">
                  {money(cycle.targets.amt)}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                  {money(cycle.targets.scPlus)}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                  {cycle.targets.laminas}
                </td>
                <td className="px-4 py-3.5 text-right tabular-nums text-slate-600">
                  {cycle.totalPersonDays}
                </td>
                <td className="px-4 py-3.5">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={"/cuotas/mensual?ciclo=" + cycle.id}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
                    >
                      Editar
                    </Link>
                    <Link
                      href={"/cuotas/seguimiento-mensual?ciclo=" + cycle.id}
                      className="inline-flex h-8 items-center rounded-lg bg-indigo-50 px-3 text-xs font-medium text-indigo-700"
                    >
                      Seguimiento
                    </Link>
                  </div>
                </td>
              </tr>
            ))}

            {cycles.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-400">
                  Todavía no hay ciclos comerciales registrados.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
