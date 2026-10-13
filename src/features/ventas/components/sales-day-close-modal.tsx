"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type {
  SalesClosureGroup,
  SalesClosureGroupUnits,
  SalesClosureReport,
} from "@/features/ventas/domain/types";

const GROUPS: Array<{ key: SalesClosureGroup; label: string }> = [
  { key: "HHP_SERIE_S", label: "HHP SERIE S" },
  { key: "HHP_SERIE_A", label: "HHP SERIE A" },
  { key: "HHP_SERIE_Z", label: "HHP SERIE Z" },
  { key: "TABLETS", label: "TABLETS" },
  { key: "WEA", label: "WEA" },
  { key: "LAMINAS", label: "LÁMINAS" },
];

export function SalesDayCloseModal({
  open,
  journeyId,
  groupUnits,
  onClose,
  onClosed,
}: {
  open: boolean;
  journeyId: string;
  groupUnits: SalesClosureGroupUnits;
  onClose: () => void;
  onClosed: (report: SalesClosureReport) => void;
}) {
  const [breakages, setBreakages] = useState<
    Record<SalesClosureGroup, { breakage: boolean; detail: string }>
  >({
    HHP_SERIE_S: { breakage: false, detail: "" },
    HHP_SERIE_A: { breakage: false, detail: "" },
    HHP_SERIE_Z: { breakage: false, detail: "" },
    TABLETS: { breakage: false, detail: "" },
    WEA: { breakage: false, detail: "" },
    LAMINAS: { breakage: false, detail: "" },
  });
  const [comments, setComments] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    const invalid = GROUPS.find(
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
          breakages: GROUPS.map(({ key }) => ({
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
      title="Feedback y Quiebres"
      description="Revisa las unidades vendidas, registra quiebres y deja el feedback del día."
      onClose={() => {
        if (!saving) onClose();
      }}
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-4">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left">Grupo</th>
                <th className="px-4 py-3 text-center">Venta unid.</th>
                <th className="px-4 py-3 text-center">Quiebre</th>
                <th className="px-4 py-3 text-left">Detalle / Nº Color</th>
              </tr>
            </thead>
            <tbody>
              {GROUPS.map(({ key, label }) => (
                <tr key={key} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {label}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold tabular-nums">
                    {groupUnits[key]}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={breakages[key].breakage ? "si" : "no"}
                      onChange={(event) =>
                        setBreakages((current) => ({
                          ...current,
                          [key]: {
                            ...current[key],
                            breakage: event.target.value === "si",
                          },
                        }))
                      }
                      className="control-input mx-auto h-9 w-24 text-xs"
                    >
                      <option value="no">NO</option>
                      <option value="si">SÍ</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      value={breakages[key].detail}
                      onChange={(event) =>
                        setBreakages((current) => ({
                          ...current,
                          [key]: {
                            ...current[key],
                            detail: event.target.value,
                          },
                        }))
                      }
                      placeholder={
                        breakages[key].breakage
                          ? "Detalle requerido"
                          : "Detalle opcional"
                      }
                      className="control-input h-9 text-sm"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Comentarios - sugerencias
          </span>
          <textarea
            value={comments}
            onChange={(event) => setComments(event.target.value)}
            rows={5}
            maxLength={2000}
            placeholder="Describe el feedback del día..."
            className="control-input min-h-32 resize-none py-3 text-sm"
          />
        </label>

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={save}
            className="h-10 rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar y cerrar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
