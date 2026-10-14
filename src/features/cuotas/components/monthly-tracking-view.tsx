import Link from "next/link";
import { MonthlyOverallTracking } from "@/features/cuotas/components/monthly-overall-tracking";
import { MonthlySellerTracking } from "@/features/cuotas/components/monthly-seller-tracking";
import type {
  MonthlyCycleSummary,
  MonthlyTrackingData,
} from "@/features/cuotas/domain/monthly-types";

function dateLabel(value: string) {
  const parts = value.split("-");
  return parts.length === 3
    ? parts[2] + "/" + parts[1] + "/" + parts[0]
    : value;
}

function cycleLabel(cycle: MonthlyCycleSummary) {
  return (
    dateLabel(cycle.startDate) +
    " - " +
    dateLabel(cycle.endDate) +
    " · " +
    cycle.commercialDays +
    " días"
  );
}

export function MonthlyTrackingView({
  data,
}: {
  data: MonthlyTrackingData;
}) {
  if (!data.schemaReady) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {data.schemaMessage}
      </section>
    );
  }

  const cycle = data.selectedCycle;

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          method="get"
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="min-w-0 flex-1">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Ciclo comercial
            </span>
            <select
              name="ciclo"
              defaultValue={cycle?.id ?? ""}
              className="control-input h-10"
            >
              {data.cycles.map((item) => (
                <option key={item.id} value={item.id}>
                  {cycleLabel(item)}
                </option>
              ))}
            </select>
          </label>

          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Ver seguimiento
          </button>

          <Link
            href={cycle ? "/cuotas/mensual?ciclo=" + cycle.id : "/cuotas/mensual"}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            Editar cuota
          </Link>
        </form>
      </section>

      {!cycle ? (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-14 text-center text-sm text-slate-400">
          Todavía no hay ciclos comerciales para mostrar.
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {dateLabel(cycle.startDate)} - {dateLabel(cycle.endDate)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {cycle.weeks} semanas · {cycle.commercialDays} días comerciales ·{" "}
                  {cycle.totalPersonDays} jornadas-persona
                </p>
              </div>
              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                {data.today < cycle.startDate
                  ? "Próximo"
                  : data.today > cycle.endDate
                    ? "Finalizado"
                    : "En curso"}
              </span>
            </div>
          </section>

          <MonthlyOverallTracking cycle={cycle} />
          <MonthlySellerTracking cycle={cycle} />
        </>
      )}
    </div>
  );
}
