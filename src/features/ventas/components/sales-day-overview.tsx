"use client";

import { faClock, faPlus, faUsers } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SalesProgressBar } from "@/features/ventas/components/sales-progress";
import type {
  SalesDayData,
  SalesStaffMember,
} from "@/features/ventas/domain/types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

export function SalesDayOverview({
  data,
  allowOperations = false,
  busy = false,
  onToggleShift,
  onRegisterSale,
}: {
  data: SalesDayData;
  allowOperations?: boolean;
  busy?: boolean;
  onToggleShift?: (person: SalesStaffMember) => void;
  onRegisterSale?: (person: SalesStaffMember) => void;
}) {
  if (!data.journey?.configured) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Este día no llegó a configurarse con cuotas y equipo.
      </section>
    );
  }

  return (
    <>
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <SalesProgressBar
          label="AMT"
          progress={data.teamProgress.amt}
          kind="money"
        />

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <SalesProgressBar
            label="Láminas"
            progress={data.teamProgress.laminas}
            kind="units"
          />
          <SalesProgressBar
            label="SC+"
            progress={data.teamProgress.scPlus}
            kind="money"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FontAwesomeIcon icon={faUsers} className="text-indigo-500" />
            Equipo comercial
          </div>
          <span className="text-xs text-slate-400">
            {data.sellerCount} vendedores con cuota
          </span>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {data.staff.map((person) => (
            <article
              key={person.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                  {person.initials}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="truncate font-semibold text-slate-900">
                        {person.name}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {person.role}
                        {person.sellsToday ? " · Vende hoy" : " · No vende hoy"}
                      </p>
                    </div>

                    <span
                      className={
                        "rounded-full px-2 py-1 text-[10px] font-semibold " +
                        (person.onShift
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500")
                      }
                    >
                      {person.onShift ? "En turno" : "Fuera de turno"}
                    </span>
                  </div>

                  <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                    <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                    Ingreso programado: {person.scheduledTime ?? "—"}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-lg bg-slate-50 py-3 text-center">
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">
                    Ventas
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-800">
                    {person.salesCount}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">
                    Unidades
                  </p>
                  <p className="mt-1 font-semibold tabular-nums text-slate-800">
                    {person.units}
                  </p>
                </div>
                <div>
                  <p className="text-[9px] uppercase tracking-wide text-slate-400">
                    Venta
                  </p>
                  <p className="mt-1 text-sm font-semibold tabular-nums text-slate-800">
                    {money(person.total)}
                  </p>
                </div>
              </div>

              {person.sellsToday ? (
                <div className="mt-4 space-y-3">
                  <SalesProgressBar
                    compact
                    label="AMT"
                    progress={person.progress.amt}
                    kind="money"
                  />
                  <SalesProgressBar
                    compact
                    label="Láminas"
                    progress={person.progress.laminas}
                    kind="units"
                  />
                  <SalesProgressBar
                    compact
                    label="SC+"
                    progress={person.progress.scPlus}
                    kind="money"
                  />
                </div>
              ) : (
                <div className="mt-4 rounded-lg bg-slate-50 px-3 py-3 text-xs text-slate-400">
                  No participa en la cuota de ventas de este día.
                </div>
              )}

              {allowOperations ? (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      data.journey?.status !== "abierta" ||
                      !person.active ||
                      person.employmentState !== "activo" ||
                      busy
                    }
                    onClick={() => onToggleShift?.(person)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 disabled:opacity-40"
                  >
                    {person.onShift ? "Finalizar turno" : "Iniciar turno"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      data.journey?.status !== "abierta" ||
                      !person.sellsToday ||
                      !person.onShift ||
                      busy
                    }
                    onClick={() => onRegisterSale?.(person)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" />
                    Registrar venta
                  </button>
                </div>
              ) : null}
            </article>
          ))}

          {data.staff.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400">
              No se registró equipo para este día.
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
