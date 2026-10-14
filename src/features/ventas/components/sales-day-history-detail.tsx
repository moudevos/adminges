"use client";

import {
  faArrowLeft,
  faLock,
  faLockOpen,
  faPowerOff,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SalesDayCloseModal } from "@/features/ventas/components/sales-day-close-modal";
import { SalesDayOverview } from "@/features/ventas/components/sales-day-overview";
import { SalesDayReportContent } from "@/features/ventas/components/sales-day-report-content";
import type { SalesDayData } from "@/features/ventas/domain/types";

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

export function SalesDayHistoryDetail({
  data,
}: {
  data: SalesDayData;
}) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [error, setError] = useState("");

  async function closeDay() {
    if (!data.journey) return;

    setClosing(true);
    setError("");

    try {
      const response = await fetch("/api/ventas/jornada/cerrar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ journeyId: data.journey.id }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo cerrar el día.");
      }

      router.refresh();
    } catch (closeError) {
      setError(
        closeError instanceof Error
          ? closeError.message
          : "No se pudo cerrar el día.",
      );
    } finally {
      setClosing(false);
    }
  }

  if (!data.journey) return null;

  const closed = data.journey.status === "cerrada";

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
              (closed
                ? "bg-slate-100 text-slate-500"
                : "bg-amber-50 text-amber-700")
            }
          >
            <FontAwesomeIcon icon={closed ? faLock : faLockOpen} />
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-slate-900">
                Día de venta · {formatDate(data.journey.date)}
              </span>
              <span
                className={
                  "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] " +
                  (closed
                    ? "bg-slate-100 text-slate-500"
                    : "bg-amber-50 text-amber-700")
                }
              >
                {closed ? "Día cerrado" : "Día abierto"}
              </span>
            </div>

            <p className="mt-1 text-xs text-slate-500">
              {data.totals.sales} ventas · {data.totals.units} unidades ·{" "}
              {money(data.totals.amount)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href="/ventas/dias"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            Histórico
          </Link>

          {!closed ? (
            <button
              type="button"
              disabled={closing}
              onClick={() => {
                if (data.journey?.configured) {
                  setCloseOpen(true);
                } else {
                  void closeDay();
                }
              }}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              <FontAwesomeIcon icon={faPowerOff} className="text-xs" />
              {closing ? "Cerrando..." : "Cerrar día"}
            </button>
          ) : null}
        </div>
      </section>

      {!data.journey.configured ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Esta jornada pertenece a una versión anterior y quedó abierta sin
          configuración completa de cuotas/equipo. Puedes cerrarla desde aquí.
        </section>
      ) : null}

      {closed && data.closureReport ? (
        <section className="overflow-hidden rounded-xl border border-[#c7d2e1] bg-white shadow-sm">
          <h2 className="bg-[#203c87] px-4 py-3 text-lg font-bold text-white">
            KIOSKO MALL IQUITOS
          </h2>
          <div className="p-4">
            <SalesDayReportContent report={data.closureReport} />
          </div>
        </section>
      ) : null}

      <SalesDayOverview data={data} />

      {data.journey?.configured ? (
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
          onClosed={() => {
            setCloseOpen(false);
            router.refresh();
          }}
        />
      ) : null}
    </div>
  );
}
