"use client";

import {
  faClock,
  faCoins,
  faLayerGroup,
  faReceipt,
  faShieldHalved,
  faSquarePlus,
  faTrophy,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  overallPercent,
  progressTone,
  SalesProgressBar,
  toneStyles,
} from "@/features/ventas/components/sales-progress";
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

function Stat({
  icon,
  label,
  value,
}: {
  icon: typeof faReceipt;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 px-2">
      <FontAwesomeIcon icon={icon} className="text-[10px] text-slate-300" />
      <p className="text-sm font-semibold tabular-nums text-slate-800">
        {value}
      </p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}

export function SalesDayOverview({
  data,
  allowOperations = false,
  busy = false,
  onRegisterSale,
}: {
  data: SalesDayData;
  allowOperations?: boolean;
  busy?: boolean;
  onRegisterSale?: (person: SalesStaffMember) => void;
}) {
  if (!data.journey?.configured) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
        Este día no llegó a configurarse con cuotas y equipo.
      </section>
    );
  }

  const team = overallPercent([
    data.teamProgress.amt,
    data.teamProgress.laminas,
    data.teamProgress.scPlus,
  ]);
  const teamTone = progressTone(team.percent, team.target);
  const teamStyle = toneStyles[teamTone];

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span
              className={
                "grid size-8 place-items-center rounded-lg " + teamStyle.soft
              }
            >
              <FontAwesomeIcon icon={faTrophy} className="text-xs" />
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-900">
                Avance del equipo
              </p>
              <p className="text-[11px] text-slate-400">
                Meta conjunta del día
              </p>
            </div>
          </div>
          <span
            className={
              "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors duration-500 " +
              teamStyle.soft
            }
          >
            {teamStyle.label}
          </span>
        </div>

        <SalesProgressBar
          label="AMT"
          icon={faCoins}
          progress={data.teamProgress.amt}
          kind="money"
        />

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <SalesProgressBar
            label="Láminas"
            icon={faLayerGroup}
            progress={data.teamProgress.laminas}
            kind="money"
          />
          <SalesProgressBar
            label="SC+"
            icon={faShieldHalved}
            progress={data.teamProgress.scPlus}
            kind="money"
          />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <FontAwesomeIcon icon={faUsers} className="text-slate-400" />
            Equipo comercial
          </div>
          <span className="text-xs text-slate-400">
            {data.sellerCount} vendedores con cuota
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.staff.map((person) => {
            const overall = person.sellsToday
              ? overallPercent([
                  person.progress.amt,
                  person.progress.laminas,
                  person.progress.scPlus,
                ])
              : { percent: 0, target: 0 };
            const tone = progressTone(overall.percent, overall.target);
            const style = toneStyles[tone];

            return (
              <article
                key={person.id}
                className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 transition-shadow duration-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.18)]"
              >
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <div
                      className={
                        "grid size-11 place-items-center rounded-full bg-slate-50 text-sm font-semibold text-slate-700 ring-2 transition-colors duration-500 " +
                        style.ring
                      }
                    >
                      {person.initials}
                    </div>
                    <span
                      className={
                        "absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white " +
                        (person.onShift ? "bg-emerald-500" : "bg-slate-300")
                      }
                      title={person.onShift ? "Jornada iniciada" : "Jornada finalizada"}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {person.name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {person.role}
                    </p>
                  </div>

                  {person.sellsToday ? (
                    <span
                      className={
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-500 " +
                        style.soft
                      }
                    >
                      {overall.percent.toFixed(0)}%
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center gap-3 text-[11px] text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <FontAwesomeIcon icon={faClock} className="text-[9px]" />
                    {person.scheduledTime ?? "—"}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    {person.onShift ? "Jornada iniciada" : data.journey?.status === "cerrada" ? "Jornada cerrada" : "Pendiente"}
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-3 divide-x divide-slate-100 rounded-xl bg-slate-50/70 py-3">
                  <Stat icon={faReceipt} label="Ventas" value={person.salesCount} />
                  <Stat
                    icon={faLayerGroup}
                    label="Unidades"
                    value={person.units}
                  />
                  <Stat icon={faCoins} label="Venta" value={money(person.total)} />
                </div>

                {person.sellsToday ? (
                  <div className="mt-4 space-y-3">
                    <SalesProgressBar
                      compact
                      label="AMT"
                      icon={faCoins}
                      progress={person.progress.amt}
                      kind="money"
                    />
                    <SalesProgressBar
                      compact
                      label="Láminas"
                      icon={faLayerGroup}
                      progress={person.progress.laminas}
                      kind="money"
                    />
                    <SalesProgressBar
                      compact
                      label="SC+"
                      icon={faShieldHalved}
                      progress={person.progress.scPlus}
                      kind="money"
                    />
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-200 px-3 py-4 text-center text-xs text-slate-400">
                    No participa en la cuota de este día.
                  </div>
                )}

                {allowOperations ? (
                  <div className="mt-auto pt-4">
                    <button
                      type="button"
                      disabled={
                        data.journey?.status !== "abierta" ||
                        !person.sellsToday ||
                        !person.active ||
                        person.employmentState !== "activo" ||
                        !person.onShift ||
                        busy
                      }
                      onClick={() => onRegisterSale?.(person)}
                      className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:bg-slate-100 disabled:text-slate-400"
                    >
                      <FontAwesomeIcon
                        icon={faSquarePlus}
                        className="text-[11px]"
                      />
                      Registrar venta
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}

          {data.staff.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
              No se registró equipo para este día.
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}