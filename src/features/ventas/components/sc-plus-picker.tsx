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
  onCancel,
}: {
  catalog: SalesCatalogItem[];
  devices: Array<{ productId: string; name: string; sku: string }>;
  disabled?: boolean;
  onAdd: (item: SalesCatalogItem, labelPrice: number, deviceId: string | null, salePrice: number) => void;
  onCancel: () => void;
}) {
  const [coverage, setCoverage] = useState<Coverage>("TR");
  const [years, setYears] = useState<1 | 2>(1);
  const [labelInput, setLabelInput] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [error, setError] = useState("");
  const [priceDraft, setPriceDraft] = useState<{ sku: string; value: string } | null>(null);

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
  // El último precio cobrado sirve como referencia, no como tarifa fija.
  // Se sustituirá por el precio configurado para la escala cuando esté cargado.
  const salePriceInput = plan && priceDraft?.sku === plan.sku
    ? priceDraft.value
    : plan?.lastSalePrice !== null && plan?.lastSalePrice !== undefined
      ? plan.lastSalePrice.toFixed(2)
      : "";

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
    const salePrice = Number(salePriceInput);
    if (!salePriceInput.trim() || !Number.isFinite(salePrice) ||
        salePrice <= 0 || Math.round(salePrice * 100) <= 0) {
      setError("Indica un precio de venta SC+ mayor a S/ 0.00.");
      return;
    }
    onAdd(plan, labelPrice, deviceId || null, salePrice);
    setLabelInput("");
    setDeviceId("");
    setPriceDraft(null);
  }

  return (
    <section className="space-y-4">
      <p className="text-xs leading-5 text-slate-500">
        La escala se determina por el precio de etiqueta del equipo. Define el
        importe SC+ antes de agregar el plan a la venta.
      </p>
      {!available ? (
        <p className="mt-3 text-xs text-amber-800">
          Catálogo no disponible. Primero aplica el SQL 017 de SC+ en Supabase.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
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
          Precio de venta SC+ (S/)
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            disabled={!plan || disabled}
            value={salePriceInput}
            onChange={(event) => {
              if (plan) setPriceDraft({ sku: plan.sku, value: event.target.value });
            }}
            placeholder="Ingresa el importe del seguro"
            className="control-input mt-1 h-10 w-full text-sm"
          />
          {plan?.lastSalePrice !== null && plan?.lastSalePrice !== undefined ? (
            <span className="mt-1 block text-[11px] font-normal text-slate-400">
              Última venta: S/ {plan.lastSalePrice.toFixed(2)}
            </span>
          ) : null}
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
      <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
        <p>
          {plan
            ? <>SKU: <strong>{plan.sku}</strong> · Escala {plan.scPlusPlan?.tier} (S/ {plan.scPlusPlan?.labelMin}–{plan.scPlusPlan?.labelMax})</>
            : "Selecciona un precio de etiqueta válido para determinar el SKU."}
        </p>
      </div>
      {error ? <p role="alert" className="text-xs text-rose-700">{error}</p> : null}
      <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600"
        >
          Cancelar
        </button>
        <button
          type="button"
          disabled={disabled || !available || !plan || !salePriceInput.trim()}
          onClick={add}
          className="h-10 rounded-lg bg-indigo-700 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Añadir SC+ a la venta
        </button>
      </div>
    </section>
  );
}
