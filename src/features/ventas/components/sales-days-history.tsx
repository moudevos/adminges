import Link from "next/link";
import type { SalesDaysHistoryData } from "@/features/ventas/domain/types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  return day && month && year ? day + "/" + month + "/" + year : value;
}

export function SalesDaysHistory({
  data,
}: {
  data: SalesDaysHistoryData;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <form
        method="get"
        className="grid gap-2 border-b border-slate-100 p-3 sm:grid-cols-[180px_180px_auto_1fr]"
      >
        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Desde
          </span>
          <input
            type="date"
            name="desde"
            defaultValue={data.from}
            className="control-input h-10"
          />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Hasta
          </span>
          <input
            type="date"
            name="hasta"
            defaultValue={data.to}
            className="control-input h-10"
          />
        </label>

        <button
          type="submit"
          className="mt-auto h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
        >
          Filtrar
        </button>

        <Link
          href="/ventas/dia"
          className="mt-auto ml-auto inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
        >
          Día actual
        </Link>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-left text-sm">
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Fecha</th>
              <th className="border-b border-slate-200 px-4 py-3">Estado</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Equipo
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Ventas
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Unidades
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Total
              </th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">
                Acción
              </th>
            </tr>
          </thead>

          <tbody>
            {data.days.map((day) => (
              <tr key={day.id} className="transition hover:bg-slate-50/70">
                <td className="border-b border-slate-100 px-4 py-3.5 font-medium text-slate-800">
                  {formatDate(day.date)}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5">
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide " +
                      (day.status === "abierta"
                        ? "bg-amber-50 text-amber-700"
                        : "bg-slate-100 text-slate-500")
                    }
                  >
                    {day.status === "abierta" ? "Abierto" : "Cerrado"}
                  </span>
                  {!day.configured ? (
                    <span className="ml-2 text-[10px] text-amber-600">
                      Sin configurar
                    </span>
                  ) : null}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right tabular-nums text-slate-600">
                  {day.staffCount}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right tabular-nums text-slate-600">
                  {day.sales}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right tabular-nums text-slate-600">
                  {day.units}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right font-semibold tabular-nums text-slate-800">
                  {money(day.amount)}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right">
                  <Link
                    href={"/ventas/dias/" + day.id}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Ver día
                  </Link>
                </td>
              </tr>
            ))}

            {data.days.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-12 text-center text-sm text-slate-400"
                >
                  No hay días de venta en el rango seleccionado.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
        {data.days.length} {data.days.length === 1 ? "día" : "días"}
      </div>
    </section>
  );
}
