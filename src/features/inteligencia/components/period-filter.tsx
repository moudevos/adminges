import Link from "next/link";
import type { CommercialIntelligence } from "@/features/inteligencia/server/loaders";

function label(date: string) {
  const [year, month, day] = date.split("-");
  return day + "/" + month + "/" + year;
}

export function PeriodFilter({
  data, path,
}: {
  data: CommercialIntelligence;
  path: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <form method="get" action={path} className="flex flex-wrap items-end gap-3">
        <label className="min-w-56 flex-1">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Mes comercial</span>
          <select name="ciclo" defaultValue={data.cycle?.id ?? ""} className="control-input">
            {data.cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {label(cycle.start)} — {label(cycle.end)}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-48">
          <span className="mb-1.5 block text-xs font-semibold text-slate-600">Modelo de predicción</span>
          <select name="modelo" defaultValue={data.model} className="control-input">
            <option value="plano">Plano · promedio diario</option>
            <option value="lineal">Lineal · tendencia diaria</option>
          </select>
        </label>
        <button type="submit" className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white">
          Actualizar análisis
        </button>
        <Link href="/cuotas/seguimiento-mensual" className="inline-flex h-10 items-center rounded-lg border border-slate-200 px-4 text-sm text-slate-600">
          Seguimiento
        </Link>
      </form>
    </section>
  );
}

export function Unavailable({
  data,
}: {
  data: CommercialIntelligence;
}) {
  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      {data.message ?? (data.cycle
        ? "Sin datos suficientes para este ciclo."
        : "Todavía no existe un mes comercial configurado. Crea la cuota mensual primero.")}
    </section>
  );
}

export function MetricCard({
  label, value, caption,
}: {
  label: string; value: string; caption?: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-950">{value}</p>
      {caption ? <p className="mt-2 text-xs text-slate-500">{caption}</p> : null}
    </article>
  );
}

export const pen = (value: number) => new Intl.NumberFormat("es-PE", {
  style: "currency", currency: "PEN", maximumFractionDigits: 0,
}).format(value);

export const pct = (value: number | null) =>
  value === null || !Number.isFinite(value)
    ? "—" : value.toLocaleString("es-PE", {
      minimumFractionDigits: 1, maximumFractionDigits: 1,
    }) + "%";
