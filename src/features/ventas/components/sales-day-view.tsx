"use client";

import {
  faCalendarDay,
  faLock,
  faPowerOff,
  faSliders,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DailyQuotaForDate } from "@/features/cuotas/domain/types";
import { PaymentMethodsModal } from "@/features/ventas/components/payment-methods-modal";
import { SalesDayCloseModal } from "@/features/ventas/components/sales-day-close-modal";
import { SalesDayReportModal } from "@/features/ventas/components/sales-day-report-modal";
import { SaleModal } from "@/features/ventas/components/sale-modal";
import { SalesDayOpeningModal } from "@/features/ventas/components/sales-day-opening-modal";
import { SalesDayOverview } from "@/features/ventas/components/sales-day-overview";
import type {
  PaymentMethodOption,
  SalesClosureReport,
  SalesDayData,
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

export function SalesDayView({
  data,
  paymentMethods,
  dailyQuota,
}: {
  data: SalesDayData;
  paymentMethods: PaymentMethodOption[];
  dailyQuota: DailyQuotaForDate;
}) {
  const router = useRouter();
  const [opening, setOpening] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [closedReport, setClosedReport] =
    useState<SalesClosureReport | null>(null);
  const [paymentSettingsOpen, setPaymentSettingsOpen] = useState(false);
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

  async function closeJourney(journeyId: string) {
    await mutate("Cerrando día...", "/api/ventas/jornada/cerrar", {
      journeyId,
    });
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

      {data.blockingOpenDay ? (
        <section className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <FontAwesomeIcon
              icon={faTriangleExclamation}
              className="mt-0.5 text-amber-600"
            />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                Hay un día anterior todavía abierto
              </p>
              <p className="mt-1 text-xs text-amber-700">
                {formatDate(data.blockingOpenDay.date)}. Debes cerrarlo antes
                de abrir una nueva jornada.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Link
              href={"/ventas/dias/" + data.blockingOpenDay.id}
              className="inline-flex h-9 items-center rounded-lg border border-amber-200 bg-white px-3 text-xs font-semibold text-amber-800"
            >
              {data.blockingOpenDay.configured ? "Completar cierre" : "Ver día"}
            </Link>
            {!data.blockingOpenDay.configured ? (
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => closeJourney(data.blockingOpenDay!.id)}
                className="h-9 rounded-lg bg-amber-700 px-3 text-xs font-semibold text-white disabled:opacity-50"
              >
                Cerrar día anterior
              </button>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div
            className={
              "grid size-10 place-items-center rounded-xl " +
              (journeyOpen
                ? "bg-emerald-50 text-emerald-600"
                : data.journey?.status === "cerrada"
                  ? "bg-slate-100 text-slate-500"
                  : "bg-indigo-50 text-indigo-600")
            }
          >
            <FontAwesomeIcon
              icon={data.journey?.status === "cerrada" ? faLock : faCalendarDay}
            />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">
                Día de venta
              </span>
              <span
                className={
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] " +
                  (journeyOpen
                    ? "bg-emerald-50 text-emerald-700"
                    : data.journey?.status === "cerrada"
                      ? "bg-slate-100 text-slate-500"
                      : "bg-indigo-50 text-indigo-700")
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
                  " unidades · " +
                  money(data.totals.amount)
                : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {!journeyOpen &&
          data.journey?.status !== "cerrada" &&
          !data.blockingOpenDay ? (
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
          ) : data.closureReport ? (
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700"
            >
              Ver reporte
            </button>
          ) : null}

          <button
            type="button"
            onClick={() => setPaymentSettingsOpen(true)}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            <FontAwesomeIcon icon={faSliders} className="text-xs" />
            Métodos de pago
          </button>

          <Link
            href="/ventas/dias"
            className="inline-flex h-10 items-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            Histórico de días
          </Link>
        </div>
      </section>

      {busy ? (
        <div className="text-xs font-medium text-slate-400">{busy}</div>
      ) : null}

      {data.journey ? (
        <SalesDayOverview
          data={data}
          allowOperations={journeyOpen}
          busy={Boolean(busy)}
          onToggleShift={toggleShift}
          onRegisterSale={setSelectedStaff}
        />
      ) : (
        <section className="rounded-xl border border-dashed border-slate-200 bg-white px-5 py-14 text-center text-sm text-slate-400">
          Abre el día para definir cuotas, equipo y horario de ingreso.
        </section>
      )}

      <SalesDayOpeningModal
        key={
          data.date +
          ":" +
          (dailyQuota.quota?.updatedAt ?? "no-quota")
        }
        open={opening}
        date={data.date}
        people={data.people}
        initialQuota={dailyQuota.quota?.values ?? null}
        suggestion={dailyQuota.suggestion}
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
          paymentMethods={paymentMethods.filter((method) => method.active)}
          onClose={() => setSelectedStaff(null)}
          onSaved={() => {
            setSelectedStaff(null);
            router.refresh();
          }}
        />
      ) : null}

      <PaymentMethodsModal
        open={paymentSettingsOpen}
        methods={paymentMethods}
        onClose={() => setPaymentSettingsOpen(false)}
      />

      {data.journey ? (
        <SalesDayCloseModal
          open={closeOpen}
          journeyId={data.journey.id}
          groupUnits={data.groupUnits}
          quotas={data.journey.quotas}
          sales={{
            amt: data.teamProgress.amt.actual,
            laminas: data.teamProgress.laminas.actual,
            scPlus: data.teamProgress.scPlus.actual,
          }}
          onClose={() => setCloseOpen(false)}
          onClosed={(report) => {
            setCloseOpen(false);
            setClosedReport(report);
            setReportOpen(true);
            router.refresh();
          }}
        />
      ) : null}

      <SalesDayReportModal
        open={reportOpen}
        report={closedReport ?? data.closureReport}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
