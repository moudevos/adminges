import Link from "next/link";
import type { SalesHistoryData } from "@/features/ventas/domain/types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function pageHref(data: SalesHistoryData, page: number) {
  const params = new URLSearchParams();
  params.set("desde", data.filters.from);
  params.set("hasta", data.filters.to);

  if (data.filters.status !== "todos") {
    params.set("estado", data.filters.status);
  }
  if (data.filters.promoterId) params.set("promotor", data.filters.promoterId);
  if (data.filters.category) params.set("categoria", data.filters.category);
  if (data.filters.type) params.set("tipo", data.filters.type);
  if (data.filters.paymentMethod) params.set("pago", data.filters.paymentMethod);
  if (data.filters.search) params.set("q", data.filters.search);
  if (page > 1) params.set("pagina", String(page));

  return "/ventas/historial?" + params.toString();
}

export function SalesHistoryTable({ data }: { data: SalesHistoryData }) {
  if (!data.schemaReady) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {data.schemaMessage}
      </section>
    );
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.pageSize));
  const currentPage = Math.min(Math.max(data.filters.page, 1), totalPages);
  const paymentNames = new Map(
    data.paymentMethods.map((method) => [method.code, method.name]),
  );

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <form
        method="get"
        className="grid gap-2 border-b border-slate-100 p-3 lg:grid-cols-4 xl:grid-cols-8"
      >
        <label className="lg:col-span-2 xl:col-span-2">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Buscar
          </span>
          <input
            name="q"
            defaultValue={data.filters.search}
            placeholder="SKU, IMEI o producto"
            className="control-input h-10 text-sm"
          />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Desde
          </span>
          <input
            type="date"
            name="desde"
            defaultValue={data.filters.from}
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
            defaultValue={data.filters.to}
            className="control-input h-10"
          />
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Estado
          </span>
          <select
            name="estado"
            defaultValue={data.filters.status}
            className="control-input h-10 text-sm"
          >
            <option value="todos">Todos</option>
            <option value="confirmada">Confirmadas</option>
            <option value="anulada">Anuladas</option>
          </select>
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Promotor
          </span>
          <select
            name="promotor"
            defaultValue={data.filters.promoterId}
            className="control-input h-10 text-sm"
          >
            <option value="">Todos</option>
            {data.promoters.map((promoter) => (
              <option key={promoter.id} value={promoter.id}>
                {promoter.name}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Categoría
          </span>
          <select
            name="categoria"
            defaultValue={data.filters.category}
            className="control-input h-10 text-sm"
          >
            <option value="">Todas</option>
            {data.categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Tipo
          </span>
          <select
            name="tipo"
            defaultValue={data.filters.type}
            className="control-input h-10 text-sm"
          >
            <option value="">Todos</option>
            {data.types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            Pago
          </span>
          <select
            name="pago"
            defaultValue={data.filters.paymentMethod}
            className="control-input h-10 text-sm"
          >
            <option value="">Todos</option>
            {data.paymentMethods.map((method) => (
              <option key={method.id} value={method.code}>
                {method.name}
                {!method.active ? " (inactivo)" : ""}
              </option>
            ))}
          </select>
        </label>

        <div className="flex items-end gap-2 lg:col-span-2 xl:col-span-2">
          <button
            type="submit"
            className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
          >
            Filtrar
          </button>
          <Link
            href="/ventas/historial"
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            Limpiar
          </Link>
        </div>
      </form>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1040px] text-left text-sm">
          <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="border-b border-slate-200 px-4 py-3">Fecha</th>
              <th className="border-b border-slate-200 px-4 py-3">Promotor</th>
              <th className="border-b border-slate-200 px-4 py-3">Estado</th>
              <th className="border-b border-slate-200 px-4 py-3">Categoría / Tipo</th>
              <th className="border-b border-slate-200 px-4 py-3">Pagos</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Unid.</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Total</th>
              <th className="border-b border-slate-200 px-4 py-3 text-right">Acción</th>
            </tr>
          </thead>

          <tbody>
            {data.rows.map((sale) => (
              <tr key={sale.id} className="transition hover:bg-slate-50/70">
                <td className="border-b border-slate-100 px-4 py-3.5 text-slate-600">
                  {dateTime(sale.date)}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 font-medium text-slate-800">
                  {sale.promoterName}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5">
                  <span
                    className={
                      "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide " +
                      (sale.status === "confirmada"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-rose-50 text-rose-700")
                    }
                  >
                    {sale.status === "confirmada" ? "Confirmada" : "Anulada"}
                  </span>
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5">
                  <p className="max-w-56 truncate text-xs font-medium text-slate-700">
                    {sale.categories.join(", ") || "—"}
                  </p>
                  <p className="mt-0.5 max-w-56 truncate text-[10px] text-slate-400">
                    {sale.types.join(", ") || "Sin tipo"}
                  </p>
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5">
                  <div className="flex max-w-52 flex-wrap gap-1">
                    {sale.paymentMethods.map((method) => (
                      <span
                        key={method}
                        className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium text-slate-600"
                      >
                        {paymentNames.get(method) ?? method}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right tabular-nums text-slate-600">
                  {sale.units}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                  {money(sale.total)}
                </td>
                <td className="border-b border-slate-100 px-4 py-3.5 text-right">
                  <Link
                    href={"/ventas/historial/" + sale.id}
                    className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    Ver
                  </Link>
                </td>
              </tr>
            ))}

            {data.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-5 py-14 text-center text-sm text-slate-400"
                >
                  No hay ventas que coincidan con los filtros.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3">
        <p className="text-xs text-slate-400">
          {data.total} {data.total === 1 ? "venta" : "ventas"}
        </p>

        <div className="flex items-center gap-2">
          <Link
            href={pageHref(data, Math.max(1, currentPage - 1))}
            aria-disabled={currentPage <= 1}
            className={
              "inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium " +
              (currentPage <= 1
                ? "pointer-events-none text-slate-300"
                : "text-slate-600 hover:bg-slate-50")
            }
          >
            Anterior
          </Link>
          <span className="text-xs tabular-nums text-slate-500">
            {currentPage} / {totalPages}
          </span>
          <Link
            href={pageHref(data, Math.min(totalPages, currentPage + 1))}
            aria-disabled={currentPage >= totalPages}
            className={
              "inline-flex h-8 items-center rounded-lg border border-slate-200 px-3 text-xs font-medium " +
              (currentPage >= totalPages
                ? "pointer-events-none text-slate-300"
                : "text-slate-600 hover:bg-slate-50")
            }
          >
            Siguiente
          </Link>
        </div>
      </div>
    </section>
  );
}
