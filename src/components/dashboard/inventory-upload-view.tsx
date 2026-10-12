"use client";

import {
  faCloudArrowUp,
  faFileExcel,
  faPaperclip,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  type DragEvent,
  type ChangeEvent,
  useState,
} from "react";

type CountMode = "digital" | "manual";

const acceptedExtensions = [".xlsx", ".xls", ".csv"];

function isAcceptedFile(file: File) {
  const lowerName = file.name.toLowerCase();
  return acceptedExtensions.some((extension) => lowerName.endsWith(extension));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function InventoryUploadView() {
  const [snapshotDate, setSnapshotDate] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState("");
  const [countMode, setCountMode] = useState<CountMode>("digital");

  function selectFile(file: File | null) {
    if (!file) return;

    if (!isAcceptedFile(file)) {
      setSelectedFile(null);
      setFileError("Usa un archivo Excel (.xlsx, .xls) o CSV.");
      return;
    }

    setSelectedFile(file);
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

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
              Subir datos de inventario
            </h2>
            <p className="mt-1.5 text-sm text-slate-500">
              Carga masiva y preparación del inventario.
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
          className={`mt-6 grid min-h-[220px] place-items-center rounded-2xl border border-dashed px-5 py-8 text-center transition ${
            dragActive
              ? "border-indigo-400 bg-indigo-50/70"
              : "border-slate-200 bg-slate-50/70"
          }`}
        >
          <div className="max-w-lg">
            <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-indigo-600 text-xl text-white shadow-lg shadow-indigo-200">
              <FontAwesomeIcon icon={faCloudArrowUp} />
            </div>

            {selectedFile ? (
              <>
                <p className="mt-4 text-sm font-semibold text-slate-900">
                  Archivo listo para preparar
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
              Formatos admitidos: XLSX, XLS y CSV
            </p>

            {fileError ? (
              <p className="mt-2 text-xs font-medium text-rose-600" role="alert">
                {fileError}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-5 grid gap-2 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setCountMode("digital")}
            className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${
              countMode === "digital"
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Generar conteo digital
          </button>

          <button
            type="button"
            onClick={() => setCountMode("manual")}
            className={`min-h-11 rounded-xl border px-4 text-sm font-semibold transition ${
              countMode === "manual"
                ? "border-indigo-600 bg-indigo-600 text-white shadow-sm shadow-indigo-200"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Generar conteo manual
          </button>

          <button
            type="button"
            disabled
            title="Se habilitará cuando conectemos el procesamiento del archivo."
            className="min-h-11 cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400"
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
            Los archivos procesados aparecerán aquí cuando conectemos el backend.
          </p>
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-[0.04em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Archivo</th>
                <th className="px-4 py-3 text-right">SKUs</th>
                <th className="px-4 py-3 text-right">Unds</th>
                <th className="px-4 py-3 text-right">Series</th>
                <th className="px-4 py-3 text-right">Nuevos</th>
                <th className="px-4 py-3 text-right">Agotados</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={7}
                  className="px-5 py-14 text-center text-sm text-slate-400"
                >
                  Aún no hay snaps procesados.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
