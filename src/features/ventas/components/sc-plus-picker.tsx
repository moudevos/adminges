"use client";

import { useMemo, useState } from "react";
import type { SalesCatalogItem } from "@/features/ventas/domain/types";

type Coverage = "TR" | "ROBO" | "PANTALLA" | "DANOS";
const COVERAGES: Array<{ value: Coverage; label: string }> = [
  { value: "TR", label: "Todo riesgo (TR)" },
  { value: "ROBO", label: "Solo robo" },
  { value: "PANTALLA", label: "Daños de pantalla" },
  { value: "DANOS", label: "Daños de pantalla e ingreso de líquidos" },
];

export function ScPlusPicker({
  catalog,
  devices,
  disabled,
  onAdd,
}: {
  catalog: SalesCatalogItem[];
  devices: Array<{ productId: string; name: string; sku: string }>;
  disabled?: boolean;
  onAdd: (item: SalesCatalogItem, labelPrice: number, deviceId: string | null) => void;
}) {
  const [coverage, setCoverage] = useState<Coverage>("TR");
  const [years, setYears] = useState<1 | 2>(1);
  const [labelInput, setLabelInput] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");

  const labelPrice = labelInput.trim() ? Number(labelInput) : NaN;
  const plan = useMemo(
    () => catalog.find((item) =>
      item.scPlusPlan?.coverage === coverage &&
      item.scPlusPlan?.years === years &&
      Number.isFinite(labelPrice) &&
      Math.ceil(labelPrice) >= item.scPlusPlan.labelMin &&
      Math.ceil(labelPrice) <= item.scPlusPlan.labelMax,
    ),
    [catalog, coverage, years, labelPrice],
  );
  const available = catalog.some((item) => Boolean(item.scPlusPlan));

  function add() {
    setError("");
    if (!Number.isFinite(labelPrice) || labelPrice < 400 || labelPrice > 10000) {
      setError("Ingresa el precio de etiqueta del equipo entre S/ 400 y S/ 10,000.");
      return;
    }
    if (!plan) {
      setError("No se encontró el SKU SC+ para la cobertura, plazo y precio seleccionados.");
      return;
    }
    onAdd(plan, labelPrice, deviceId || null);
    setLabelInput("");
    setDeviceId("");
  }

  return (
    <section className="mt-5 rounded-xl border border-indigo-200 bg-indigo-50/60 p-4">
      <h3 className="text-sm font-semibold text-indigo-900">Samsung Care+ · SC+ (intangible)</h3>
      <p className="mt-1 text-xs text-indigo-700">
        El rango se define por el precio de etiqueta del equipo. El importe cobrado
        por el plan se introduce después de agregarlo a la venta.
      </p>
      {!available ? (
        <p className="mt-3 text-xs text-amber-800">
          Catálogo no disponible. Primero aplica el SQL 017 de SC+ en Supabase.
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium text-slate-600">
          Cobertura
          <select
            value={coverage}
            onChange={(event) => setCoverage(event.target.value as Coverage)}
            className="control-input mt-1 h-10 w-full text-xs"
          >
            {COVERAGES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Vigencia
          <select
            value={years}
            onChange={(event) => setYears(Number(event.target.value) as 1 | 2)}
            className="control-input mt-1 h-10 w-full text-xs"
          >
            <option value={1}>1 año · SSC+</option>
            <option value={2}>2 años · BA_SSC+</option>
          </select>
        </label>
        <label className="text-xs font-medium text-slate-600">
          Precio de etiqueta del equipo (S/)
          <input
            type="number"
            min="400"
            max="10000"
            step="0.01"
            value={labelInput}
            onChange={(event) => setLabelInput(event.target.value)}
            placeholder="Ej. 2499.00"
            className="control-input mt-1 h-10 w-full text-sm"
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Equipo de esta venta (opcional)
          <select
            value={deviceId}
            onChange={(event) => setDeviceId(event.target.value)}
            className="control-input mt-1 h-10 w-full text-xs"
          >
            <option value="">Sin vincular</option>
            {devices.map((device) => (
              <option key={device.productId} value={device.productId}>
                {device.sku} · {device.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-indigo-900">
          {plan
            ? <>SKU: <strong>{plan.sku}</strong> · Escala {plan.scPlusPlan?.tier} (S/ {plan.scPlusPlan?.labelMin}–{plan.scPlusPlan?.labelMax})</>
            : "Selecciona un precio de etiqueta válido para determinar el SKU."}
        </p>
        <button
          type="button"
          disabled={disabled || !available || !plan}
          onClick={add}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Añadir SC+ a la venta
        </button>
      </div>
      {error ? <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p> : null}
    </section>
  );
}
