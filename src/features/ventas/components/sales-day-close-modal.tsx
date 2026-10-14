"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import {
  CLOSURE_REPORT_GROUPS,
  CLOSURE_TABLE_CELL,
  SalesDayReportComments,
  SalesDayReportMetrics,
  SalesDayReportTableHeader,
} from "@/features/ventas/components/sales-day-report-content";
import type {
  SalesClosureGroup,
  SalesClosureGroupUnits,
  SalesClosureReport,
  SalesQuotas,
} from "@/features/ventas/domain/types";

const EMPTY_BREAKAGES: Record<
  SalesClosureGroup,
  { breakage: boolean; detail: string }
> = {
  HHP_SERIE_S: { breakage: false, detail: "" },
  HHP_SERIE_A: { breakage: false, detail: "" },
  HHP_SERIE_Z: { breakage: false, detail: "" },
  TABLETS: { breakage: false, detail: "" },
  LAMINAS: { breakage: false, detail: "" },
  WEA: { breakage: false, detail: "" },
};

export function SalesDayCloseModal({
  open,
  journeyId,
  quotas,
  sales,
  groupUnits,
  onClose,
  onClosed,
}: {
  open: boolean;
  journeyId: string;
  quotas: SalesQuotas;
  sales: SalesQuotas;
  groupUnits: SalesClosureGroupUnits;
  onClose: () => void;
  onClosed: (report: SalesClosureReport) => void;
}) {
  const [breakages, setBreakages] = useState(EMPTY_BREAKAGES);
  const [showWea, setShowWea] = useState(false);
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const includeWea =
    groupUnits.WEA > 0 ||
    showWea ||
    breakages.WEA.breakage ||
    Boolean(breakages.WEA.detail.trim());

  const groups = CLOSURE_REPORT_GROUPS.filter(
    ({ key }) => key !== "WEA" || includeWea,
  );

  async function save() {
    const invalid = CLOSURE_REPORT_GROUPS.find(
      ({ key }) => breakages[key].breakage && !breakages[key].detail.trim(),
    );

    if (invalid) {
      setError("Agrega detalle al quiebre de " + invalid.label + ".");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/ventas/jornada/cerrar-reporte", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          journeyId,
          comments,
          // Conservar WEA en el contrato SQL aun cuando no tenga ventas.
          breakages: CLOSURE_REPORT_GROUPS.map(({ key }) => ({
            group: key,
            breakage: breakages[key].breakage,
            detail: breakages[key].detail,
          })),
        }),
      });

      const payload = (await response.json()) as {
        report?: {
          jornada_id: string;
          cuota_amt: number;
          venta_amt: number;
          cuota_laminas: number;
          venta_laminas: number;
          cuota_sc_plus: number;
          venta_sc_plus: number;
          comentarios: string | null;
          created_at: string;
          quiebres: Array<{
            grupo: SalesClosureGroup;
            venta_unid: number;
            quiebre: boolean;
            detalle: string | null;
          }>;
        };
        message?: string;
      };

      if (!response.ok || !payload.report) {
        throw new Error(payload.message ?? "No se pudo cerrar el día.");
      }

      // El reporte devuelto por SQL es el snapshot definitivo, no la vista previa.
      onClosed({
        journeyId: payload.report.jornada_id,
        quotas: {
          amt: Number(payload.report.cuota_amt),
          laminas: Number(payload.report.cuota_laminas),
          scPlus: Number(payload.report.cuota_sc_plus),
        },
        sales: {
          amt: Number(payload.report.venta_amt),
          laminas: Number(payload.report.venta_laminas),
          scPlus: Number(payload.report.venta_sc_plus),
        },
        comments: payload.report.comentarios,
        closedAt: payload.report.created_at,
        breakages: payload.report.quiebres.map((item) => ({
          group: item.grupo,
          units: Number(item.venta_unid),
          breakage: Boolean(item.quiebre),
          detail: item.detalle,
        })),
      });
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo cerrar el día.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      title="KIOSKO MALL IQUITOS"
      variant="report"
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidthClassName="max-w-5xl"
    >
      <div className="space-y-4">
        {error ? (
          <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <SalesDayReportMetrics quotas={quotas} sales={sales} />

        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] table-fixed border-collapse bg-white" aria-label="Ventas y quiebres al cerrar">
            <SalesDayReportTableHeader />
            <tbody>
              {groups.map(({ key, label }) => (
                <tr key={key}>
                  <th scope="row" className={CLOSURE_TABLE_CELL + " text-left font-medium"}>
                    {label}
                  </th>
                  <td className={CLOSURE_TABLE_CELL + " text-center tabular-nums"}>
                    {groupUnits[key]}
                  </td>
                  <td className={CLOSURE_TABLE_CELL + " p-1 text-center"}>
                    <select
                      aria-label={"Quiebres " + label}
                      value={breakages[key].breakage ? "si" : "no"}
                      disabled={saving}
                      onChange={(event) =>
                        setBreakages((current) => ({
                          ...current,
                          [key]: {
                            ...current[key],
                            breakage: event.target.value === "si",
                          },
                        }))
                      }
                      className="w-full min-w-0 rounded bg-white px-2 py-1.5 text-center text-[13px] text-[#45546e] outline-offset-2 focus-visible:outline-2 focus-visible:outline-indigo-600"
                    >
                      <option value="no">NO</option>
                      <option value="si">SÍ</option>
                    </select>
                  </td>
                  <td className={CLOSURE_TABLE_CELL + " p-1"}>
                    <input
                      aria-label={"Detalle *No Color " + label}
                      value={breakages[key].detail}
                      disabled={saving}
                      maxLength={300}
                      onChange={(event) =>
                        setBreakages((current) => ({
                          ...current,
                          [key]: {
                            ...current[key],
                            detail: event.target.value,
                          },
                        }))
                      }
                      placeholder={breakages[key].breakage ? "Detalle requerido" : ""}
                      className="w-full min-w-0 rounded border border-transparent bg-transparent px-2 py-1.5 text-[13px] text-[#45546e] outline-none placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100 disabled:opacity-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!includeWea ? (
          <button
            type="button"
            disabled={saving}
            onClick={() => setShowWea(true)}
            className="-mt-2 text-xs font-medium text-indigo-700 underline-offset-2 hover:underline"
          >
            Añadir quiebre WEA
          </button>
        ) : null}

        <SalesDayReportComments>
          <textarea
            aria-label="Comentarios - sugerencias"
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={3}
            maxLength={2000}
            disabled={saving}
            placeholder="Describe el movimiento del día y las sugerencias..."
            className="block min-h-24 w-full resize-y bg-white px-3.5 py-3 text-[13px] leading-5 text-[#4a5675] outline-offset-[-3px] focus-visible:outline-2 focus-visible:outline-indigo-600 disabled:opacity-50"
          />
        </SalesDayReportComments>

        <p className="text-[11px] text-slate-500">
          Vista previa: al confirmar, el sistema recalcula las ventas y unidades
          y guarda los resultados definitivos del día.
        </p>

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-200 pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="h-10 rounded-lg bg-[#203c87] px-5 text-sm font-semibold text-white transition hover:bg-[#172f70] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar y cerrar jornada"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
