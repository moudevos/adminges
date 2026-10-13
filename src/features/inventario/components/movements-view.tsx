import { faArrowRightLong, faMagnifyingGlass } from "@fortawesome/free-solid-svg-icons";
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

function logicalLocation(warehouse: string | null, location: string | null) {
  if (
    warehouse &&
    warehouse.trim().toLowerCase() !== MAIN_WAREHOUSE.toLowerCase()
  ) {
    return "Tránsito";
  }

  return location?.trim() || "—";
}

function movementRoute(movement: InventoryKardexMovement) {
  if (movement.direccion === "traslado") {
    const origin = logicalLocation(
      movement.almacenOrigen,
      movement.ubicacionOrigen,
    );
    const destination = logicalLocation(
      movement.almacenDestino,
      movement.ubicacionDestino,
    );

    return origin === destination
      ? { from: origin, to: null }
      : { from: origin, to: destination };
  }

  if (movement.direccion === "entrada") {
    return {
      from: logicalLocation(movement.almacenDestino, movement.ubicacionDestino),
      to: null,
    };
  }

  return {
    from: logicalLocation(movement.almacenOrigen, movement.ubicacionOrigen),
    to: null,
  };
}

function movementLabel(movement: InventoryKardexMovement) {
  if (movement.tipo === "venta") return "Venta";
  if (movement.direccion === "traslado" || movement.tipo === "traslado") {
    return "Traslado";
  }
  if (movement.tipo === "snapshot_inicial") return "Ingreso inicial";
  if (movement.direccion === "entrada") return "Ingreso conciliación";
  if (movement.clasificacion === "pendiente_venta") return "Salida pendiente";
  return "Salida conciliación";
}

function dotClass(direccion: InventoryKardexMovement["direccion"]) {
  if (direccion === "entrada") return "bg-emerald-500";
  if (direccion === "traslado") return "bg-slate-300";
  return "bg-rose-400";
}

function quantityDisplay(movement: InventoryKardexMovement) {
  if (movement.direccion === "traslado") {
    return { text: "↔ " + movement.cantidad, className: "text-slate-400" };
  }

  if (movement.direccion === "entrada") {
    return { text: "+" + movement.cantidad, className: "text-emerald-600" };
  }

  return { text: "−" + movement.cantidad, className: "text-rose-600" };
}

function totalClass(total: number) {
  if (total > 0) return "text-emerald-700";
  if (total < 0) return "text-rose-700";
  return "text-slate-900";
}

const emptyState = "px-5 py-14 text-center text-sm text-slate-400";

const MODES: Array<{ value: InventoryMovementSearchMode; label: string }> = [
  { value: "sku", label: "SKU" },
  { value: "imei", label: "IMEI" },
];

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
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white">
      <form
        action="/inventario/movimientos"
        method="get"
        className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3"
      >
        {/* Selector segmentado */}
        <div
          role="radiogroup"
          aria-label="Tipo de búsqueda"
          className="inline-flex h-9 rounded-lg bg-slate-100 p-0.5"
        >
          {MODES.map((option) => (
            <label key={option.value} className="cursor-pointer">
              <input
                type="radio"
                name="tipo"
                value={option.value}
                defaultChecked={mode === option.value}
                className="peer sr-only"
              />
              <span className="flex h-8 items-center rounded-md px-3 text-xs font-medium text-slate-500 transition peer-checked:bg-white peer-checked:text-slate-900 peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-indigo-200">
                {option.label}
              </span>
            </label>
          ))}
        </div>

        <label className="relative min-w-[200px] flex-1">
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
            placeholder="Código a consultar"
            className="h-9 w-full rounded-lg border border-transparent bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          />
        </label>

        <button
          type="submit"
          className="h-9 rounded-lg bg-indigo-600 px-4 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Buscar
        </button>
      </form>

      {!response ? (
        <div className={emptyState}>Elige SKU o IMEI y escribe el código.</div>
      ) : null}

      {response?.status === "not-found" && query ? (
        <div className={emptyState}>
          Sin coincidencias para el {modeLabel} “{query}”.
        </div>
      ) : null}

      {response?.status === "error" ? (
        <div className="px-5 py-14 text-center text-sm text-rose-600">
          {response.message}
        </div>
      ) : null}

      {found ? (
        <>
          {/* Resumen */}
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-500">
                {found.mode === "imei" ? "IMEI" : "SKU"}
              </span>
              <span className="font-mono text-sm font-semibold text-slate-800">
                {found.mode === "imei" ? found.serial : found.sku}
              </span>
              {found.mode === "imei" ? (
                <>
                  <span aria-hidden className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono text-xs text-slate-400">
                    {found.sku}
                  </span>
                </>
              ) : null}
              <span className="hidden truncate text-sm text-slate-400 sm:block">
                {found.descripcion}
              </span>
            </div>

            <div className="flex shrink-0 items-baseline gap-2">
              <span className="text-xs text-slate-400">Total</span>
              <span
                className={
                  "text-xl font-semibold tabular-nums " + totalClass(found.total)
                }
              >
                {found.total}
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-medium text-slate-400">
                  <th className="px-4 py-2.5">Fecha</th>
                  <th className="px-4 py-2.5">Producto</th>
                  <th className="px-4 py-2.5">Almacén</th>
                  <th className="px-4 py-2.5">Movimiento</th>
                  <th className="px-4 py-2.5 text-right">Cantidad</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-50">
                {found.movements.map((movement) => {
                  const quantity = quantityDisplay(movement);
                  const route = movementRoute(movement);
                  const serial =
                    found.mode === "imei" ? movement.serial : null;

                  return (
                    <tr
                      key={movement.id}
                      className="transition hover:bg-slate-50/70"
                    >
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums text-slate-500">
                        {formatDate(movement.fecha)}
                      </td>

                      <td className="px-4 py-2.5">
                        <div className="min-w-[220px]">
                          <p className="font-medium leading-5 text-slate-900">
                            {movement.descripcion}
                          </p>
                          <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                            <span>{movement.sku}</span>
                            {serial ? (
                              <>
                                <span aria-hidden className="font-sans">
                                  ·
                                </span>
                                <span>{serial}</span>
                              </>
                            ) : null}
                          </p>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          {route.from}
                          {route.to ? (
                            <>
                              <FontAwesomeIcon
                                icon={faArrowRightLong}
                                className="text-[9px] text-slate-300"
                              />
                              {route.to}
                            </>
                          ) : null}
                        </span>
                      </td>

                      <td className="px-4 py-2.5">
                        <span className="inline-flex items-center gap-2 text-slate-700">
                          <span
                            className={
                              "size-1.5 rounded-full " +
                              dotClass(movement.direccion)
                            }
                          />
                          {movementLabel(movement)}
                        </span>
                      </td>

                      <td
                        className={
                          "px-4 py-2.5 text-right font-semibold tabular-nums " +
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
                    <td colSpan={5} className={emptyState}>
                      Este producto aún no tiene movimientos.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-400">
            <span className="tabular-nums">
              {found.movements.length}{" "}
              {found.mode === "sku"
                ? found.movements.length === 1
                  ? "movimiento consolidado"
                  : "movimientos consolidados"
                : found.movements.length === 1
                  ? "movimiento"
                  : "movimientos"}
            </span>
            <span>Los traslados no afectan el total.</span>
          </div>
        </>
      ) : null}
    </section>
  );
}