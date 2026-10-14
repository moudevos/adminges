import Link from "next/link";
import type { DashboardSummary } from "@/features/dashboard/server/loaders";

const money = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

const shortcuts = [
  { title: "Día de venta", subtitle: "Registrar y revisar ventas", href: "/ventas/dia" },
  { title: "Seguimiento mensual", subtitle: "Revisar el avance de cuotas", href: "/cuotas/seguimiento-mensual" },
  { title: "Stock", subtitle: "Consultar inventario actual", href: "/inventario/stock" },
  { title: "Personal", subtitle: "Consultar el equipo", href: "/personal" },
];

export function DashboardOverview({ data }: { data: DashboardSummary }) {
  const dayLabel = new Intl.DateTimeFormat("es-PE", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(data.date + "T12:00:00Z"));

  const cards = [
    {
      label: "Ventas de hoy",
      value: data.salesAmount === null ? "—" : money.format(data.salesAmount),
      detail: "Importe de ventas confirmadas",
    },
    {
      label: "Transacciones",
      value: data.salesCount === null ? "—" : String(data.salesCount),
      detail: "Ventas confirmadas hoy",
    },
    {
      label: "Cuota diaria",
      value: data.dailyTarget === null ? "Sin definir" : money.format(data.dailyTarget),
      detail: "Meta de ventas del día",
    },
    {
      label: "Cumplimiento",
      value: data.progressPercent === null ? "—" : data.progressPercent.toLocaleString("es-PE") + "%",
      detail: "Ventas frente a la cuota diaria",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-6xl space-y-7">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-indigo-600">
          Panel principal
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
          Dashboard
        </h2>
        <p className="mt-2 text-sm text-slate-500">
          Resumen de hoy · {dayLabel}
        </p>
      </section>

      {data.partialData ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Algunos indicadores no pudieron cargarse. Los datos no disponibles se muestran con «—».
        </p>
      ) : null}

      <section aria-label="Indicadores del día">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <article key={card.label} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">
                {card.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">{card.detail}</p>
            </article>
          ))}
        </div>
        {data.progressPercent !== null ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            <div className="mb-2 flex items-center justify-between gap-3 text-xs font-medium text-slate-500">
              <span>Avance de la cuota diaria</span>
              <span>{data.progressPercent.toLocaleString("es-PE")}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Cumplimiento de la cuota diaria"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(100, Math.max(0, data.progressPercent))}
              className="h-2.5 overflow-hidden rounded-full bg-slate-100"
            >
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: Math.min(100, Math.max(0, data.progressPercent)) + "%" }}
              />
            </div>
          </div>
        ) : null}
      </section>

      <section aria-labelledby="dashboard-shortcuts">
        <h3 id="dashboard-shortcuts" className="mb-4 text-base font-semibold text-slate-900">
          Accesos rápidos
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {shortcuts.map((shortcut) => (
            <Link
              key={shortcut.href}
              href={shortcut.href}
              className="group flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 transition hover:border-indigo-200 hover:bg-indigo-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              <span>
                <span className="block text-sm font-semibold text-slate-900">{shortcut.title}</span>
                <span className="mt-1 block text-xs text-slate-500">{shortcut.subtitle}</span>
              </span>
              <span aria-hidden="true" className="text-lg text-slate-400 transition group-hover:translate-x-1 group-hover:text-indigo-600">
                →
              </span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
