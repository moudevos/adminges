"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";
import {
  createProduct,
  registerInventoryLoad,
  type InventoryActionState,
} from "@/app/dashboard/inventory-actions";

type ProductRow = {
  id: string;
  sku: string;
  nombre: string;
  marca: string | null;
  categoria: string | null;
  costo: number;
  precio: number;
  stock_minimo: number;
  is_active: boolean;
};

type StockRow = ProductRow & {
  stock_actual: number;
  valor_stock: number;
};

type MovementRow = {
  id: number;
  producto_id: string;
  tipo: string;
  cantidad: number;
  costo_unitario: number | null;
  referencia: string | null;
  nota: string | null;
  fecha: string;
};

type Props = {
  activeView: string;
  products: ProductRow[];
  stock: StockRow[];
  movements: MovementRow[];
};

const initialState: InventoryActionState = { ok: false, message: "" };

const tabs = [
  { key: "cargar", label: "Cargar" },
  { key: "stock", label: "Stock" },
  { key: "analisis", label: "Análisis" },
];

export function InventoryManagement({ activeView, products, stock, movements }: Props) {
  const view = tabs.some((item) => item.key === activeView) ? activeView : "stock";

  return (
    <div className="space-y-4">
      <Tabs active={view} />
      {view === "cargar" ? (
        <LoadView products={products} movements={movements} />
      ) : view === "analisis" ? (
        <AnalysisView stock={stock} movements={movements} />
      ) : (
        <StockView stock={stock} />
      )}
    </div>
  );
}

function Tabs({ active }: { active: string }) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={`/dashboard?module=inventario&view=${tab.key}`}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium ${
            active === tab.key
              ? "bg-slate-950 text-white"
              : "text-slate-500 hover:bg-slate-50 hover:text-slate-950"
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}

function LoadView({ products, movements }: { products: ProductRow[]; movements: MovementRow[] }) {
  const [productOpen, setProductOpen] = useState(false);
  const [loadOpen, setLoadOpen] = useState(false);
  const [productState, productAction, productPending] = useActionState(createProduct, initialState);
  const [loadState, loadAction, loadPending] = useActionState(registerInventoryLoad, initialState);
  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  useEffect(() => {
    if (productState.ok) setProductOpen(false);
  }, [productState]);

  useEffect(() => {
    if (loadState.ok) setLoadOpen(false);
  }, [loadState]);

  return (
    <>
      {(productState.message || loadState.message) && (
        <ActionMessage state={productState.message ? productState : loadState} />
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Movimientos de carga</h2>
            <p className="mt-1 text-xs text-slate-500">
              Registra productos y entradas de inventario.
            </p>
          </div>
          <div className="flex gap-2">
            <SecondaryButton onClick={() => setProductOpen(true)}>Nuevo producto</SecondaryButton>
            <PrimaryButton onClick={() => setLoadOpen(true)} disabled={products.length === 0}>
              Registrar carga
            </PrimaryButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Fecha</th>
                <th className="px-5 py-3 font-medium">Producto</th>
                <th className="px-5 py-3 font-medium">Tipo</th>
                <th className="px-5 py-3 text-right font-medium">Cantidad</th>
                <th className="px-5 py-3 font-medium">Referencia</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {movements.map((movement) => {
                const product = productMap.get(movement.producto_id);
                return (
                  <tr key={movement.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4 text-xs text-slate-500">{formatDate(movement.fecha)}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">{product?.nombre ?? "Producto"}</p>
                      <p className="text-xs text-slate-400">{product?.sku ?? movement.producto_id}</p>
                    </td>
                    <td className="px-5 py-4 capitalize text-slate-600">{movement.tipo.replaceAll("_", " ")}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-900">{movement.cantidad}</td>
                    <td className="px-5 py-4 text-slate-500">{movement.referencia || "—"}</td>
                  </tr>
                );
              })}
              {movements.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-400">
                    Todavía no hay movimientos de inventario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={productOpen}
        title="Nuevo producto"
        description="Crea el producto antes de registrar existencias."
        onClose={() => !productPending && setProductOpen(false)}
      >
        <form action={productAction} className="grid gap-4 sm:grid-cols-2">
          <Field label="SKU" name="sku" required />
          <Field label="Nombre" name="nombre" required />
          <Field label="Marca" name="marca" />
          <Field label="Categoría" name="categoria" />
          <Field label="Costo" name="costo" type="number" min="0" step="0.01" defaultValue="0" required />
          <Field label="Precio" name="precio" type="number" min="0" step="0.01" defaultValue="0" required />
          <Field label="Stock mínimo" name="stock_minimo" type="number" min="0" step="1" defaultValue="0" required />
          {!productState.ok && productState.message && (
            <div className="sm:col-span-2"><ActionMessage state={productState} /></div>
          )}
          <div className="sm:col-span-2">
            <ModalActions
              pending={productPending}
              onCancel={() => setProductOpen(false)}
              label="Crear producto"
            />
          </div>
        </form>
      </Modal>

      <Modal
        open={loadOpen}
        title="Registrar carga"
        description="Agrega unidades al stock del producto seleccionado."
        onClose={() => !loadPending && setLoadOpen(false)}
      >
        <form action={loadAction} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Producto</span>
            <select name="producto_id" required defaultValue="" className="control-input">
              <option value="" disabled>Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.sku} · {product.nombre}
                </option>
              ))}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Cantidad" name="cantidad" type="number" min="1" step="1" required />
            <Field label="Costo unitario" name="costo_unitario" type="number" min="0" step="0.01" />
          </div>
          <Field label="Referencia" name="referencia" placeholder="Guía, factura o documento" />
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Nota</span>
            <textarea name="nota" rows={3} className="control-input resize-none" />
          </label>
          {!loadState.ok && loadState.message && <ActionMessage state={loadState} />}
          <ModalActions pending={loadPending} onCancel={() => setLoadOpen(false)} label="Registrar carga" />
        </form>
      </Modal>
    </>
  );
}

function StockView({ stock }: { stock: StockRow[] }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-950">Stock actual</h2>
        <p className="mt-1 text-xs text-slate-500">{stock.length} productos activos</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[950px] text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-5 py-3 font-medium">SKU</th>
              <th className="px-5 py-3 font-medium">Producto</th>
              <th className="px-5 py-3 font-medium">Categoría</th>
              <th className="px-5 py-3 text-right font-medium">Stock</th>
              <th className="px-5 py-3 text-right font-medium">Mínimo</th>
              <th className="px-5 py-3 text-right font-medium">Costo</th>
              <th className="px-5 py-3 text-right font-medium">Valor</th>
              <th className="px-5 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stock.map((item) => {
              const low = item.stock_actual <= item.stock_minimo;
              return (
                <tr key={item.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-500">{item.sku}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{item.nombre}</p>
                    <p className="text-xs text-slate-400">{item.marca || "Sin marca"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{item.categoria || "—"}</td>
                  <td className="px-5 py-4 text-right text-base font-semibold text-slate-950">{item.stock_actual}</td>
                  <td className="px-5 py-4 text-right text-slate-500">{item.stock_minimo}</td>
                  <td className="px-5 py-4 text-right text-slate-600">{money(item.costo)}</td>
                  <td className="px-5 py-4 text-right font-medium text-slate-900">{money(item.valor_stock)}</td>
                  <td className="px-5 py-4">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      low ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                    }`}>
                      {low ? "Stock bajo" : "Disponible"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {stock.length === 0 && (
              <tr>
                <td colSpan={8} className="px-5 py-10 text-center text-slate-400">
                  Crea un producto y registra la primera carga.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AnalysisView({ stock, movements }: { stock: StockRow[]; movements: MovementRow[] }) {
  const totalUnits = stock.reduce((sum, item) => sum + item.stock_actual, 0);
  const totalValue = stock.reduce((sum, item) => sum + item.valor_stock, 0);
  const lowStock = stock.filter((item) => item.stock_actual <= item.stock_minimo).length;
  const loadedUnits = movements
    .filter((movement) => movement.tipo === "carga")
    .reduce((sum, movement) => sum + movement.cantidad, 0);

  const top = [...stock].sort((a, b) => b.stock_actual - a.stock_actual).slice(0, 6);
  const max = Math.max(1, ...top.map((item) => item.stock_actual));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Productos" value={String(stock.length)} />
        <Metric label="Unidades en stock" value={String(totalUnits)} />
        <Metric label="Stock bajo" value={String(lowStock)} />
        <Metric label="Valor inventario" value={money(totalValue)} />
      </div>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-950">Productos con mayor stock</h2>
          <div className="mt-5 space-y-4">
            {top.map((item) => (
              <div key={item.id}>
                <div className="mb-1.5 flex items-center justify-between gap-4 text-xs">
                  <span className="truncate font-medium text-slate-700">{item.nombre}</span>
                  <span className="font-semibold text-slate-950">{item.stock_actual}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-950"
                    style={{ width: `${Math.max(4, (item.stock_actual / max) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            {top.length === 0 && <p className="text-sm text-slate-400">Sin datos todavía.</p>}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Movimientos recientes</p>
          <p className="mt-3 text-3xl font-semibold text-slate-950">{movements.length}</p>
          <p className="mt-1 text-sm text-slate-500">Últimos movimientos consultados.</p>
          <div className="mt-6 border-t border-slate-100 pt-4">
            <p className="text-xs text-slate-400">Unidades cargadas en la muestra</p>
            <p className="mt-1 text-xl font-semibold text-slate-900">{loadedUnits}</p>
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  min,
  step,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        min={min}
        step={step}
        defaultValue={defaultValue}
        className="control-input"
      />
    </label>
  );
}

function Modal({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Cerrar modal" className="absolute inset-0" onClick={onClose} />
      <section className="relative z-10 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-5">
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
        </div>
        {children}
      </section>
    </div>
  );
}

function ModalActions({
  pending,
  onCancel,
  label,
}: {
  pending: boolean;
  onCancel: () => void;
  label: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
      >
        {pending ? "Procesando..." : label}
      </button>
    </div>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function SecondaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
    >
      {children}
    </button>
  );
}

function ActionMessage({ state }: { state: InventoryActionState }) {
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${
      state.ok
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-rose-200 bg-rose-50 text-rose-700"
    }`}>
      {state.message}
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
