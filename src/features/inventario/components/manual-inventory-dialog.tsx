"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { ManualInventoryLocation } from "@/features/inventario/server/manual-inventory";

type Orientation = "landscape" | "portrait";

export function ManualInventoryDialog({
  open,
  options,
  onClose,
}: {
  open: boolean;
  options: ManualInventoryLocation[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(
    options[0] ? JSON.stringify([options[0].warehouse, options[0].location]) : "",
  );
  const [orientation, setOrientation] = useState<Orientation>("landscape");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [smallFont, setSmallFont] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!pdfUrl) return;
    return () => URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const option = options.find(
    (item) => JSON.stringify([item.warehouse, item.location]) === selected,
  ) ?? options[0];

  function closeAll() {
    if (loading) return;
    setPdfUrl(null);
    setError("");
    onClose();
  }

  async function generate() {
    if (!option || loading) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        warehouse: option.warehouse,
        location: option.location,
        orientation,
      });
      const response = await fetch("/api/inventario/manual/pdf?" + params, {
        cache: "no-store",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({})) as { message?: string };
        throw new Error(body.message ?? "No se pudo generar el PDF.");
      }
      const blob = await response.blob();
      if (!blob.type.includes("pdf") || blob.size === 0) {
        throw new Error("El servidor no devolvió un PDF válido.");
      }
      setSmallFont(Number(response.headers.get("X-Inventory-Min-Font-Size") ?? 10) < 4.5);
      setPdfUrl(URL.createObjectURL(blob));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "No se pudo generar el PDF.");
    } finally {
      setLoading(false);
    }
  }

  const filename = (
    "conteo-manual-" + (option?.location ?? "stock") + "-" +
    (orientation === "landscape" ? "horizontal" : "vertical") + "-A4.pdf"
  ).normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "-");

  return (
    <>
      <Modal
        open={open && !pdfUrl}
        title="Conteo manual"
        onClose={closeAll}
        maxWidthClassName="max-w-md"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">
              Almacén
            </span>
            <select
              value={option ? JSON.stringify([option.warehouse, option.location]) : ""}
              disabled={loading || options.length === 0}
              onChange={(event) => setSelected(event.target.value)}
              className="control-input"
            >
              {options.length === 0 ? <option value="">Sin almacenes con stock</option> : null}
              {options.map((item) => (
                <option
                  key={JSON.stringify([item.warehouse, item.location])}
                  value={JSON.stringify([item.warehouse, item.location])}
                >
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <fieldset>
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
              Orientación de página A4
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {([
                ["landscape", "Horizontal"],
                ["portrait", "Vertical"],
              ] as const).map(([value, label]) => (
                <label key={value} className={
                  "flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-sm font-medium " +
                  (orientation === value
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600")
                }>
                  <input
                    type="radio"
                    name="manual-a4-orientation"
                    value={value}
                    checked={orientation === value}
                    disabled={loading}
                    onChange={() => setOrientation(value)}
                    className="accent-indigo-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-xs leading-5 text-slate-500">
            Se generará un PDF de una sola página con el stock disponible del
            almacén seleccionado. Las cuatro columnas son HHP, TAB, ACC y LÁMINAS,
            cada una con Producto (SKU - descripción), Stock y OK.
          </p>

          {error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4">
            <button
              type="button"
              disabled={loading}
              onClick={closeAll}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={loading || !option}
              onClick={generate}
              className="h-10 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "Generando..." : "Generar PDF"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        open={open && Boolean(pdfUrl)}
        title="Previsualización de hoja de verificación"
        onClose={closeAll}
        maxWidthClassName="max-w-6xl"
      >
        {pdfUrl ? (
          <div className="space-y-3">
            {smallFont ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Hay muchos productos en esta ubicación. Para mantenerlos en una
                sola página A4, la letra es pequeña. Prueba la otra orientación
                si necesitas mejorar su legibilidad.
              </p>
            ) : null}
            <iframe
              title="Previsualización del inventario manual A4"
              src={pdfUrl}
              className="h-[65vh] min-h-80 w-full rounded border border-slate-200 bg-slate-50"
            />
            <div className="flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setPdfUrl(null)}
                className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-700"
              >
                Cambiar almacén u orientación
              </button>
              <a
                href={pdfUrl}
                download={filename}
                className="inline-flex h-10 items-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white"
              >
                Descargar PDF
              </a>
              <button
                type="button"
                onClick={closeAll}
                className="h-10 rounded-lg bg-slate-600 px-4 text-sm font-semibold text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
