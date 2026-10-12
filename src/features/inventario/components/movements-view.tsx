import {
  faArrowRightArrowLeft,
  faChevronDown,
  faMagnifyingGlass,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type {
  InventoryKardexMovement,
  InventoryMovementSearchMode,
  InventoryMovementSearchResponse,
} from "@/features/inventario/domain/types";
import { MAIN_WAREHOUSE } from "@/features/inventario/domain/types";

function formatDate(value: string) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return day + "/" + month + "/" + year;
}

function logicalLocation(
  warehouse: string | null,
  location: string | null,
) {
  if (
    warehouse &&
    warehouse.trim().toLowerCase() !== MAIN_WAREHOUSE.toLowerCase()
  ) {
    return "Tránsito";
  }

  return location?.trim() || "—";
}

function movementLocation(movement: InventoryKardexMovement) {
  if (movement.direccion === "traslado") {
    const origin = logicalLocation(
      movement.almacenOrigen,
      movement.ubicacionOrigen,
    );
    const destination = logicalLocation(
      movement.almacenDestino,
      movement.ubicacionDestino,
    );

    if (origin === destination) return origin;
    return origin + " → " + destination;
  }

  if (movement.direccion === "entrada") {
    return logicalLocation(
      movement.almacenDestino,
      movement.ubicacionDestino,
    );
  }

  return logicalLocation(
    movement.almacenOrigen,
    movement.ubicacionOrigen,
  );
}

function movementLabel(movement: InventoryKardexMovement) {
  if (movement.tipo === "venta") return "Venta";
  if (movement.direccion === "traslado" || movement.tipo === "traslado") {
    return "Traslado";
  }
  if (movement.tipo === "snapshot_inicial") return "Ingreso inicial";
  if (movement.direccion === "entrada") return "Ingreso conciliación";
  if (movement.clasificacion === "pendiente_venta") {
    return "Salida pendiente";
  }
  return "Salida conciliación";
}

function quantityDisplay(movement: InventoryKardexMovement) {
  if (movement.direccion === "traslado") {
    return {
      text: "↔ " + movement.cantidad,
      className: "text-indigo-600",
    };
  }

  if (movement.direccion === "entrada") {
    return {
      text: "+" + movement.cantidad,
      className: "text-emerald-600",
    };
  }

  return {
    text: "-" + movement.cantidad,
    className: "text-rose-600",
  };
}

function totalClass(total: number) {
  if (total > 0) return "text-emerald-700";
  if (total < 0) return "text-rose-700";
  return "text-slate-900";
}

export function InventoryMovementsView({
  mode,
  query,
  response,
}: {
  mode: InventoryMovementSearchMode;
  query: string;
  response: InventoryMovementSearchResponse | null;
}) {
  const found = response?.status === "found" ? response.result : null;
  const modeLabel = mode === "imei" ? "IMEI" : "SKU";

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <form
        action="/inventario/movimientos"
        method="get"
        className="grid gap-2 border-b border-slate-100 p-2.5 sm:grid-cols-[120px_minmax(0,1fr)_auto]"
      >
        <label className="relative block">
          <span className="sr-only">Tipo de búsqueda</span>
          <select
            name="tipo"
            defaultValue={mode}
            className="control-input h-10 appearance-none pr-8 text-sm font-medium"
          >
            <option value="sku">SKU</option>
            <option value="imei">IMEI</option>
          </select>
          <FontAwesomeIcon
            icon={faChevronDown}
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-400"
          />
        </label>

        <label className="relative min-w-0">
          <span className="sr-only">Buscar por {modeLabel}</span>
          <FontAwesomeIcon
            icon={faMagnifyingGlass}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-slate-400"
          />
          <input
            name="q"
            type="search"
            defaultValue={query}
            autoComplete="off"
            spellCheck={false}
            placeholder={
              mode === "imei"
                ? "Buscar IMEI o serie"
                : "Buscar SKU"
            }
            className="control-input h-10 pl-9 text-sm"
          />
        </label>

        <button
          type="submit"
          className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Buscar
        </button>
      </form>

      {response?.status === "not-found" && query ? (
        <div className="px-5 py-12 text-center text-sm text-slate-400">
          No se encontró el {modeLabel} “{query}”.
        </div>
      ) : null}

      {response?.status === "error" ? (
        <div className="px-5 py-12 text-center text-sm text-rose-600">
          {response.message}
        </div>
      ) : null}

      {!response ? (
        <div className="px-5 py-12 text-center text-sm text-slate-400">
          Selecciona SKU o IMEI e ingresa el valor a consultar.
        </div>
      ) : null}

      {found ? (
        <>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
            <span className="rounded-md bg-slate-100 px-2 py-1 font-semibold uppercase tracking-wide text-slate-600">
              {found.mode === "imei" ? "IMEI" : "SKU"}
            </span>
            <span className="font-mono font-semibold text-slate-700">
              {found.mode === "imei" ? found.serial : found.sku}
            </span>
            {found.mode === "imei" ? (
              <>
                <span className="text-slate-300">·</span>
                <span className="font-mono font-semibold text-slate-600">
                  {found.sku}
                </span>
              </>
            ) : null}
            <span className="text-slate-300">·</span>
            <span className="min-w-0 flex-1 truncate">{found.descripcion}</span>
            <span className="text-slate-400">Total</span>
            <span
              className={
                "text-base font-bold tabular-nums " + totalClass(found.total)
              }
            >
              {found.total}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] text-left text-sm">
              <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-2.5">
                    Fecha
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2.5">
                    SKU
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2.5">
                    Descripción
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2.5">
                    Serie
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2.5">
                    Almacén
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2.5">
                    Movimiento
                  </th>
                  <th className="border-b border-slate-200 px-4 py-2.5 text-right">
                    Cantidad
                  </th>
                </tr>
              </thead>

              <tbody>
                {found.movements.map((movement) => {
                  const quantity = quantityDisplay(movement);

                  return (
                    <tr
                      key={movement.id}
                      className="transition hover:bg-slate-50/60"
                    >
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-500">
                        {formatDate(movement.fecha)}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs font-semibold text-slate-600">
                        {movement.sku}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 font-medium text-slate-800">
                        {movement.descripcion}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 font-mono text-xs text-slate-500">
                        {found.mode === "sku"
                          ? "—"
                          : movement.serial || "No aplica"}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3 text-slate-600">
                        {movementLocation(movement)}
                      </td>
                      <td className="border-b border-slate-100 px-4 py-3">
                        <span
                          className={
                            "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium " +
                            (movement.direccion === "traslado"
                              ? "bg-indigo-50 text-indigo-700"
                              : movement.direccion === "entrada"
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-rose-50 text-rose-700")
                          }
                        >
                          {movement.direccion === "traslado" ? (
                            <FontAwesomeIcon
                              icon={faArrowRightArrowLeft}
                              className="text-[9px]"
                            />
                          ) : null}
                          {movementLabel(movement)}
                        </span>
                      </td>
                      <td
                        className={
                          "border-b border-slate-100 px-4 py-3 text-right font-semibold tabular-nums " +
                          quantity.className
                        }
                      >
                        {quantity.text}
                      </td>
                    </tr>
                  );
                })}

                {found.movements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-5 py-12 text-center text-sm text-slate-400"
                    >
                      El producto existe, pero todavía no tiene movimientos en
                      el Kardex.
                    </td>
                  </tr>
                ) : null}
              </tbody>

              <tfoot>
                <tr className="bg-slate-50/70">
                  <td
                    colSpan={6}
                    className="border-t border-slate-200 px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.05em] text-slate-500"
                  >
                    Total
                  </td>
                  <td
                    className={
                      "border-t border-slate-200 px-4 py-3 text-right text-base font-bold tabular-nums " +
                      totalClass(found.total)
                    }
                  >
                    {found.total}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
            {found.movements.length}{" "}
            {found.mode === "sku"
              ? found.movements.length === 1
                ? "movimiento consolidado"
                : "movimientos consolidados"
              : found.movements.length === 1
                ? "movimiento"
                : "movimientos"}{" "}
            · Los traslados no modifican el total neto.
          </div>
        </>
      ) : null}
    </section>
  );
}
