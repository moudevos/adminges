"use client";

import {
  faCalendarDay,
  faClock,
  faPlus,
  faPowerOff,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { SaleModal } from "@/features/ventas/components/sale-modal";
import { SalesDayOpeningModal } from "@/features/ventas/components/sales-day-opening-modal";
import { SalesProgressBar } from "@/features/ventas/components/sales-progress";
import type {
  SalesRegistrationData,
  SalesStaffMember,
} from "@/features/ventas/domain/types";

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

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(payload.message ?? "No se pudo completar la operación.");
  }
}

export function SalesRegistrationView({
  data,
}: {
  data: SalesRegistrationData;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<SalesStaffMember | null>(
    null,
  );
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function mutate(label: string, path: string, body: unknown) {
    setBusy(label);
    setError("");

    try {
      await postJson(path, body);
      router.refresh();
    } catch (mutationError) {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "No se pudo completar la operación.",
      );
    } finally {
      setBusy("");
    }
  }

  async function toggleShift(person: SalesStaffMember) {
    if (!data.journey) return;

    await mutate(
      person.onShift ? "Finalizando turno..." : "Iniciando turno...",
      "/api/ventas/jornada/turno",
      {
        journeyId: data.journey.id,
        personId: person.id,
        onShift: !person.onShift,
      },
    );
  }

  async function closeDay() {
    if (!data.journey) return;

    await mutate(
      "Cerrando jornada...",
      "/api/ventas/jornada/cerrar",
      { journeyId: data.journey.id },
    );
    setCloseOpen(false);
  }

  if (!data.schemaReady) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {data.schemaMessage}
      </section>
    );
  }

  const journeyOpen =
    data.journey?.status === "abierta" && data.journey.configured;

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={
              "grid size-10 place-items-center rounded-xl " +
              (journeyOpen
                ? "bg-emerald-50 text-emerald-600"
                : "bg-slate-100 text-slate-500")
            }
          >
            <FontAwesomeIcon icon={faCalendarDay} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">
                Ventas del día
              </span>
              <span
                className={
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] " +
                  (journeyOpen
                    ? "bg-emerald-50 text-emerald-700"
                    : data.journey?.status === "cerrada"
                      ? "bg-slate-100 text-slate-500"
                      : "bg-amber-50 text-amber-700")
                }
              >
                {journeyOpen
                  ? "Día en curso"
                  : data.journey?.status === "cerrada"
                    ? "Día cerrado"
                    : "Sin abrir"}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              {formatDate(data.date)}
              {data.journey
                ? " · " +
                  data.totals.sales +
                  " ventas · " +
                  data.totals.units +
                  " unidades"
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!journeyOpen && data.journey?.status !== "cerrada" ? (
            <button
              type="button"
              onClick={() => setOpening(true)}
              className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
            >
              {data.journey ? "Configurar día" : "Abrir día"}
            </button>
          ) : journeyOpen ? (
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => setCloseOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              <FontAwesomeIcon icon={faPowerOff} className="text-xs" />
              Cerrar día
            </button>
          ) : null}
        </div>
      </section>

      {busy ? (
        <div className="text-xs font-medium text-slate-400">{busy}</div>
      ) : null}

      {data.journey?.configured ? (
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
      ) : null}

      {data.journey?.configured ? (
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
                        {person.onShift ? "En turno" : "Pendiente"}
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
                    No participa en la cuota de ventas de hoy.
                  </div>
                )}

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    disabled={
                      data.journey?.status !== "abierta" ||
                      !person.active ||
                      person.employmentState !== "activo" ||
                      Boolean(busy)
                    }
                    onClick={() => toggleShift(person)}
                    className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 disabled:opacity-40"
                  >
                    {person.onShift ? "Finalizar turno" : "Iniciar turno"}
                  </button>

                  <button
                    type="button"
                    disabled={
                      !journeyOpen ||
                      !person.sellsToday ||
                      !person.onShift ||
                      Boolean(busy)
                    }
                    onClick={() => setSelectedStaff(person)}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <FontAwesomeIcon icon={faPlus} className="text-xs" />
                    Registrar venta
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <SalesDayOpeningModal
        open={opening}
        date={data.date}
        people={data.people}
        onClose={() => setOpening(false)}
        onSaved={() => {
          setOpening(false);
          router.refresh();
        }}
      />

      {selectedStaff && data.journey ? (
        <SaleModal
          staff={selectedStaff}
          journeyId={data.journey.id}
          date={data.date}
          catalog={data.catalog}
          onClose={() => setSelectedStaff(null)}
          onSaved={() => {
            setSelectedStaff(null);
            router.refresh();
          }}
        />
      ) : null}

      <Modal
        open={closeOpen}
        title="Cerrar jornada"
        description={
          formatDate(data.date) +
          " · " +
          data.totals.sales +
          " ventas · " +
          money(data.totals.amount)
        }
        onClose={() => setCloseOpen(false)}
        maxWidthClassName="max-w-md"
      >
        {data.journey ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-3 text-center text-xs">
              <div>
                <p className="text-slate-400">AMT</p>
                <p className="mt-1 font-semibold">{money(data.journey.quotas.amt)}</p>
              </div>
              <div>
                <p className="text-slate-400">Láminas</p>
                <p className="mt-1 font-semibold">{data.journey.quotas.laminas}</p>
              </div>
              <div>
                <p className="text-slate-400">SC+</p>
                <p className="mt-1 font-semibold">{money(data.journey.quotas.scPlus)}</p>
              </div>
            </div>

            <p className="text-sm leading-6 text-slate-600">
              Se guardará el cierre con las cuotas y el equipo configurados en
              la apertura. Después no se podrán registrar nuevas ventas.
            </p>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setCloseOpen(false)}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={closeDay}
                className="h-10 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                Cerrar jornada
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
