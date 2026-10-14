"use client";

import {
  faCoins,
  faLayerGroup,
  faLightbulb,
  faShieldHalved,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SalesProgressBar } from "@/features/ventas/components/sales-progress";
import type { DailyQuotaPageData } from "@/features/cuotas/domain/types";

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

export function DailyQuotaView({ data }: { data: DailyQuotaPageData }) {
  const router = useRouter();
  const [amt, setAmt] = useState(
    data.quota ? String(data.quota.values.amt) : "",
  );
  const [laminas, setLaminas] = useState(
    data.quota ? String(data.quota.values.laminas) : "",
  );
  const [scPlus, setScPlus] = useState(
    data.quota ? String(data.quota.values.scPlus) : "",
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  if (!data.schemaReady) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {data.schemaMessage}
      </section>
    );
  }

  const locked = Boolean(data.quota?.locked);

  function useSuggestion() {
    if (!data.suggestion || locked) return;

    setAmt(String(data.suggestion.values.amt));
    setLaminas(String(data.suggestion.values.laminas));
    setScPlus(String(data.suggestion.values.scPlus));
    setMessage("Sugerencia cargada. Revisa los valores antes de guardar.");
  }

  async function save() {
    if (locked) return;

    if (amt.trim() === "" || laminas.trim() === "" || scPlus.trim() === "") {
      setMessage("Ingresa AMT, Láminas y SC+.");
      return;
    }

    const parsedAmt = Number(amt);
    const parsedLaminas = Number(laminas);
    const parsedScPlus = Number(scPlus);

    if (
      !Number.isFinite(parsedAmt) ||
      !Number.isFinite(parsedLaminas) ||
      !Number.isFinite(parsedScPlus) ||
      parsedAmt < 0 ||
      parsedLaminas < 0 ||
      parsedScPlus < 0
    ) {
      setMessage("Revisa los valores de la cuota.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/cuotas/diaria", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: data.date,
          amt: parsedAmt,
          laminas: parsedLaminas,
          scPlus: parsedScPlus,
        }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo guardar la cuota.");
      }

      setMessage("Cuota diaria guardada.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la cuota diaria.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <form
          method="get"
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="w-full sm:w-52">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Fecha
            </span>
            <input
              type="date"
              name="fecha"
              defaultValue={data.date}
              className="control-input h-10"
            />
          </label>
          <button
            type="submit"
            className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            Ver fecha
          </button>
          <Link
            href="/ventas/dia"
            className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600 sm:ml-auto"
          >
            Día de venta
          </Link>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {formatDate(data.date)}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {locked
                ? "Cuota aplicada a una jornada. Queda bloqueada para conservar el histórico."
                : data.quota
                  ? "Puedes ajustar la cuota mientras el día no haya sido abierto."
                  : "Todavía no existe una cuota registrada para esta fecha."}
            </p>
          </div>

          {data.quota ? (
            <span
              className={
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide " +
                (locked
                  ? "bg-slate-100 text-slate-500"
                  : "bg-indigo-50 text-indigo-700")
              }
            >
              {locked
                ? data.quota.journeyStatus === "cerrada"
                  ? "Aplicada · día cerrado"
                  : "Aplicada · día abierto"
                : data.quota.origin === "manual"
                  ? "Manual"
                  : "Desde apertura"}
            </span>
          ) : null}
        </div>

        {message ? (
          <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            {message}
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-3">
          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Cuota AMT
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={locked}
              value={amt}
              onChange={(event) => setAmt(event.target.value)}
              placeholder="S/ 0.00"
              className="control-input h-10 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Cuota Láminas
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={locked}
              value={laminas}
              onChange={(event) => setLaminas(event.target.value)}
              placeholder="S/ 0.00"
              className="control-input h-10 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>

          <label>
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Cuota SC+
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              disabled={locked}
              value={scPlus}
              onChange={(event) => setScPlus(event.target.value)}
              placeholder="S/ 0.00"
              className="control-input h-10 disabled:bg-slate-50 disabled:text-slate-400"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={locked || saving}
            onClick={save}
            className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
          >
            {saving ? "Guardando..." : data.quota ? "Actualizar cuota" : "Guardar cuota"}
          </button>

          {data.suggestion ? (
            <button
              type="button"
              disabled={locked || saving}
              onClick={useSuggestion}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-medium text-indigo-700 disabled:opacity-40"
            >
              <FontAwesomeIcon icon={faLightbulb} className="text-xs" />
              Usar sugerencia
            </button>
          ) : null}
        </div>

        {data.suggestion ? (
          <div className="mt-4 grid gap-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
            <div>
              <p className="text-xs font-semibold text-indigo-800">
                Sugerencia
              </p>
              <p className="mt-0.5 text-[11px] text-indigo-500">
                {data.suggestion.label}. No se aplica automáticamente.
              </p>
            </div>
            <div className="text-xs text-slate-500">
              AMT{" "}
              <b className="ml-1 text-slate-800">
                {money(data.suggestion.values.amt)}
              </b>
            </div>
            <div className="text-xs text-slate-500">
              Láminas{" "}
              <b className="ml-1 text-slate-800">
                {money(data.suggestion.values.laminas)}
              </b>
            </div>
            <div className="text-xs text-slate-500">
              SC+{" "}
              <b className="ml-1 text-slate-800">
                {money(data.suggestion.values.scPlus)}
              </b>
            </div>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4">
          <p className="text-sm font-semibold text-slate-900">
            Avance de la fecha
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Se actualiza con las ventas confirmadas de la jornada.
          </p>
        </div>

        <SalesProgressBar
          label="AMT"
          icon={faCoins}
          progress={data.progress.amt}
          kind="money"
        />

        <div className="mt-4 grid gap-5 md:grid-cols-2">
          <SalesProgressBar
            label="Láminas"
            icon={faLayerGroup}
            progress={data.progress.laminas}
            kind="money"
          />
          <SalesProgressBar
            label="SC+"
            icon={faShieldHalved}
            progress={data.progress.scPlus}
            kind="money"
          />
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">
            Cuotas registradas
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-4 py-3">Fecha</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">
                  AMT
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">
                  Láminas
                </th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">
                  SC+
                </th>
                <th className="border-b border-slate-200 px-4 py-3">Origen</th>
                <th className="border-b border-slate-200 px-4 py-3">Estado</th>
                <th className="border-b border-slate-200 px-4 py-3 text-right">
                  Acción
                </th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="border-b border-slate-100 px-4 py-3.5 font-medium text-slate-800">
                    {formatDate(row.date)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3.5 text-right tabular-nums">
                    {money(row.values.amt)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3.5 text-right tabular-nums">
                    {money(row.values.laminas)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3.5 text-right tabular-nums">
                    {money(row.values.scPlus)}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3.5 text-xs text-slate-500">
                    {row.origin === "manual" ? "Manual" : "Apertura"}
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3.5">
                    <span
                      className={
                        "rounded-full px-2 py-1 text-[10px] font-semibold " +
                        (row.locked
                          ? "bg-slate-100 text-slate-500"
                          : "bg-indigo-50 text-indigo-700")
                      }
                    >
                      {row.locked
                        ? row.journeyStatus === "cerrada"
                          ? "Día cerrado"
                          : "Aplicada"
                        : "Editable"}
                    </span>
                  </td>
                  <td className="border-b border-slate-100 px-4 py-3.5 text-right">
                    <Link
                      href={"/cuotas/diaria?fecha=" + row.date}
                      className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
                    >
                      Ver
                    </Link>
                  </td>
                </tr>
              ))}

              {data.history.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-sm text-slate-400"
                  >
                    Todavía no hay cuotas diarias registradas.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
