"use client";

import {
  faCloudArrowUp,
  faFileExcel,
  faPaperclip,
  faTriangleExclamation,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type DragEvent, useState } from "react";
import { LoadingIndicator } from "@/components/dashboard/loading-indicator";
import { Modal } from "@/components/ui/modal";
import type {
  InventoryValidationError,
  PreparedSnapshot,
  SnapshotHistoryRow,
} from "@/lib/inventory/types";

type CountMode = "digital" | "manual";

const acceptedExtensions = [".xlsx", ".xls", ".csv"];

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return acceptedExtensions.some((extension) => lowerName.endsWith(extension));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return String(bytes) + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function signed(value: number) {
  if (value === 0) return "Sin cambios";
  return value > 0 ? "+" + value : String(value);
}

function statusLabel(status: string) {
  if (status === "applied") return "Aplicado";
  if (status === "validated") return "Validado";
  if (status === "error") return "Error";
  if (status === "superseded") return "Reemplazado";
  return "Subido";
}

function statusClass(status: string) {
  if (status === "applied") return "bg-emerald-50 text-emerald-700";
  if (status === "error") return "bg-rose-50 text-rose-700";
  if (status === "validated") return "bg-indigo-50 text-indigo-700";
  return "bg-slate-100 text-slate-600";
}

export function InventoryUploadView({
  history,
}: {
  history: SnapshotHistoryRow[];
}) {
  const router = useRouter();
  const [snapshotDate, setSnapshotDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState("");
  const [validationErrors, setValidationErrors] = useState<
    InventoryValidationError[]
  >([]);
  const [countMode, setCountMode] = useState<CountMode>("digital");
  const [prepared, setPrepared] = useState<PreparedSnapshot | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState(
    "Validando inventario...",
  );
  const [successMessage, setSuccessMessage] = useState("");

  function selectFile(file: File | null) {
    if (!file) return;

    if (!isAcceptedFile(file)) {
      setSelectedFile(null);
      setFileError("Usa un archivo Excel (.xlsx, .xls) o CSV.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setSelectedFile(null);
      setFileError("El archivo supera el límite de 10 MB.");
      return;
    }

    setSelectedFile(file);
    setPrepared(null);
    setValidationErrors([]);
    setSuccessMessage("");
    setFileError("");
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0] ?? null);
  }

  async function prepareSnapshot() {
    if (!selectedFile) return;

    if (!snapshotDate) {
      setFileError("Selecciona la fecha del snapshot.");
      return;
    }

    setProcessing(true);
    setProcessingMessage("Leyendo, validando y comparando snapshots...");
    setValidationErrors([]);
    setFileError("");
    setSuccessMessage("");

    const formData = new FormData();
    formData.set("file", selectedFile);
    formData.set("snapshotDate", snapshotDate);

    try {
      const response = await fetch("/api/inventory/snapshots/prepare", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as {
        message?: string;
        errors?: InventoryValidationError[];
        snapshot?: PreparedSnapshot;
      };

      if (!response.ok || !payload.snapshot) {
        setFileError(payload.message ?? "No se pudo procesar el archivo.");
        setValidationErrors(payload.errors ?? []);
        return;
      }

      setPrepared(payload.snapshot);
    } catch {
      setFileError("No se pudo conectar con el servidor.");
    } finally {
      setProcessing(false);
    }
  }

  async function applySnapshot() {
    if (!prepared) return;

    setProcessing(true);
    setProcessingMessage("Actualizando inventario y generando Kardex...");

    try {
      const response = await fetch("/api/inventory/snapshots/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ snapshotId: prepared.id }),
      });
      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        setFileError(payload.message ?? "No se pudo actualizar el inventario.");
        return;
      }

      setPrepared(null);
      setSelectedFile(null);
      setValidationErrors([]);
      setFileError("");
      setSuccessMessage(
        "Inventario actualizado. El snapshot vigente y el Kardex fueron generados correctamente.",
      );
      router.refresh();
    } catch {
      setFileError("No se pudo completar la actualización.");
    } finally {
      setProcessing(false);
    }
  }

  function chooseAnotherFile() {
    setPrepared(null);
    setSelectedFile(null);
    setValidationErrors([]);
    setFileError("");
  }

  return (
    <div className="space-y-5">
      {processing ? (
        <LoadingIndicator overlay message={processingMessage} />
      ) : null}

      {successMessage ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Subir datos de inventario
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              El Excel se valida contra el snapshot vigente antes de actualizar.
            </p>
          </div>

          <label className="w-full lg:w-48">
            <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
              Fecha del snap
            </span>
            <input
              type="date"
              value={snapshotDate}
              onChange={(event) => setSnapshotDate(event.target.value)}
              className="control-input"
            />
          </label>
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            if (event.currentTarget === event.target) setDragActive(false);
          }}
          onDrop={handleDrop}
          className={
            "mt-6 grid min-h-[220px] place-items-center rounded-2xl border border-dashed px-5 py-8 text-center transition " +
            (dragActive
              ? "border-indigo-400 bg-indigo-50/70"
              : "border-slate-200 bg-slate-50/70")
          }
        >
          <div className="max-w-lg">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-600 text-xl text-white shadow-lg shadow-indigo-200">
              <FontAwesomeIcon icon={faCloudArrowUp} />
            </div>

            {selectedFile ? (
              <>
                <p className="mt-4 text-sm font-semibold text-slate-900">
                  Archivo listo para validar
                </p>
                <div className="mx-auto mt-3 flex max-w-md items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left shadow-sm">
                  <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                    <FontAwesomeIcon icon={faFileExcel} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {selectedFile.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {formatBytes(selectedFile.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedFile(null);
                      setPrepared(null);
                      setValidationErrors([]);
                      setFileError("");
                    }}
                    className="grid size-8 place-items-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Quitar archivo"
                  >
                    <FontAwesomeIcon icon={faXmark} />
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="mt-4 text-sm font-semibold text-slate-900">
                  Arrastra y suelta tu archivo aquí
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  o carga desde tu equipo
                </p>
              </>
            )}

            <label className="mt-4 inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50">
              <FontAwesomeIcon icon={faPaperclip} className="text-xs" />
              {selectedFile ? "Cambiar archivo" : "Adjuntar archivo"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="sr-only"
                onChange={handleInputChange}
              />
            </label>

            <p className="mt-3 text-[11px] text-slate-400">
              Formatos admitidos: XLSX, XLS y CSV · máximo 10 MB
            </p>

            {fileError ? (
              <p className="mt-3 text-xs font-medium text-rose-600" role="alert">
                {fileError}
              </p>
            ) : null}
          </div>
        </div>

        {validationErrors.length > 0 ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-rose-700">
              <FontAwesomeIcon icon={faTriangleExclamation} />
              El archivo no puede aplicarse
            </div>
            <div className="mt-3 max-h-48 space-y-1 overflow-y-auto text-xs text-rose-700">
              {validationErrors.slice(0, 20).map((error, index) => (
                <p key={error.code + "-" + String(error.row ?? 0) + "-" + index}>
                  {error.row ? "Fila " + error.row + ": " : ""}
                  {error.message}
                </p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setCountMode("digital")}
            className={
              "min-h-11 rounded-xl border px-4 text-sm font-semibold transition " +
              (countMode === "digital"
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
            }
          >
            Generar conteo digital
          </button>

          <button
            type="button"
            onClick={() => setCountMode("manual")}
            className={
              "min-h-11 rounded-xl border px-4 text-sm font-semibold transition " +
              (countMode === "manual"
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
            }
          >
            Generar conteo manual
          </button>

          <button
            type="button"
            disabled={!selectedFile || processing}
            onClick={prepareSnapshot}
            className="min-h-11 rounded-xl border border-indigo-600 bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            Actualizar datos
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900">
            Historial de snaps subidos
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            Cada actualización conserva el archivo fuente y su resultado.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[1040px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3 text-right">SKUs</th>
                <th className="px-4 py-3 text-right">Unds</th>
                <th className="px-4 py-3 text-right">Series</th>
                <th className="px-4 py-3 text-right">Nuevos</th>
                <th className="px-4 py-3 text-right">Agotados</th>
                <th className="px-4 py-3">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.map((snapshot) => (
                <tr key={snapshot.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 text-slate-600">
                    {snapshot.snapshotDate}
                  </td>
                  <td className="max-w-64 truncate px-4 py-3 font-medium text-slate-800">
                    {snapshot.fileName}
                  </td>
                  <td className="px-4 py-3 text-right">{snapshot.skuCount}</td>
                  <td className="px-4 py-3 text-right">{snapshot.unitCount}</td>
                  <td className="px-4 py-3 text-right">{snapshot.seriesCount}</td>
                  <td className="px-4 py-3 text-right">{snapshot.newSkuCount}</td>
                  <td className="px-4 py-3 text-right">
                    {snapshot.exhaustedSkuCount}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        "rounded-full px-2.5 py-1 text-[11px] font-medium " +
                        statusClass(snapshot.status)
                      }
                    >
                      {statusLabel(snapshot.status)}
                    </span>
                  </td>
                </tr>
              ))}

              {history.length === 0 ? (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-14 text-center text-sm text-slate-400"
                  >
                    Aún no hay snaps procesados.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={Boolean(prepared)}
        title="Confirmar actualización de inventario"
        description="El archivo ya fue validado. Revisa las diferencias antes de reemplazar el snapshot vigente."
        onClose={() => setPrepared(null)}
        maxWidthClassName="max-w-xl"
      >
        {prepared ? (
          <div className="space-y-5">
            {prepared.warningLargeDifference ? (
              <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                <FontAwesomeIcon
                  icon={faTriangleExclamation}
                  className="mt-0.5"
                />
                <span>
                  Advertencia: el archivo presenta una diferencia de{" "}
                  {Math.abs(prepared.difference.skuCount)} productos respecto al
                  inventario actual.
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Sistema
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {prepared.current.skuCount}
                </p>
                <p className="text-xs text-slate-500">
                  {prepared.current.units} unidades
                </p>
              </div>
              <div className="rounded-xl bg-indigo-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-indigo-400">
                  Archivo
                </p>
                <p className="mt-1 text-lg font-semibold text-indigo-700">
                  {prepared.candidate.skuCount}
                </p>
                <p className="text-xs text-indigo-600">
                  {prepared.candidate.units} unidades
                </p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">
                  Diferencia
                </p>
                <p className="mt-1 text-lg font-semibold text-slate-900">
                  {signed(prepared.difference.skuCount)}
                </p>
                <p className="text-xs text-slate-500">
                  {signed(prepared.difference.units)} unidades
                </p>
              </div>
            </div>

            <div className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              {prepared.locations.map((location) => (
                <div
                  key={location.name}
                  className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                >
                  <span className="font-medium text-slate-700">
                    {location.name}
                  </span>
                  <span
                    className={
                      location.difference === 0
                        ? "text-slate-400"
                        : location.difference > 0
                          ? "font-semibold text-emerald-600"
                          : "font-semibold text-rose-600"
                    }
                  >
                    {signed(location.difference)}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={chooseAnotherFile}
                className="min-h-10 rounded-xl border border-slate-200 px-4 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Subir otro archivo
              </button>
              <button
                type="button"
                onClick={applySnapshot}
                className="min-h-10 rounded-xl bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Subir y actualizar
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
