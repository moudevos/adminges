"use client";

import {
  faArrowRight,
  faBoxOpen,
  faBuildingColumns,
  faBullseye,
  faCashRegister,
  faCircleExclamation,
  faCreditCard,
  faMinus,
  faMobileScreenButton,
  faMoneyBillWave,
  faPlus,
  faQrcode,
  faTrash,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useMemo, useRef, useState } from "react";
import { Modal } from "@/components/ui/modal";
import type {
  SalePaymentMethod,
  SalesCatalogItem,
  SalesStaffMember,
} from "@/features/ventas/domain/types";

type DraftItem = {
  key: number;
  productId: string;
  sku: string;
  name: string;
  serial: string | null;
  serialized: boolean;
  serialOptions: string[];
  quantity: number;
  available: number;
  price: string;
};

type DraftPayment = {
  key: number;
  method: SalePaymentMethod;
  amount: string;
  reference: string;
};

const paymentLabels: Record<SalePaymentMethod, string> = {
  efectivo: "Efectivo",
  tarjeta: "Tarjeta",
  yape: "Yape",
  plin: "Plin",
  transferencia: "Transferencia",
};

const paymentMeta: Record<
  SalePaymentMethod,
  { icon: IconDefinition; tile: string }
> = {
  efectivo: { icon: faMoneyBillWave, tile: "bg-emerald-50 text-emerald-600" },
  tarjeta: { icon: faCreditCard, tile: "bg-sky-50 text-sky-600" },
  yape: { icon: faMobileScreenButton, tile: "bg-violet-50 text-violet-600" },
  plin: { icon: faWallet, tile: "bg-cyan-50 text-cyan-600" },
  transferencia: {
    icon: faBuildingColumns,
    tile: "bg-slate-100 text-slate-600",
  },
};

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

function cents(value: string | number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

function fromCents(value: number) {
  return (value / 100).toFixed(2);
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json()) as { message?: string };

  if (!response.ok) {
    throw new Error(payload.message ?? "No se pudo registrar la venta.");
  }
}

function SectionTitle({
  children,
  aside,
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold text-slate-800">{children}</h3>
      {aside}
    </div>
  );
}

export function SaleModal({
  staff,
  journeyId,
  date,
  catalog,
  onClose,
  onSaved,
}: {
  staff: SalesStaffMember;
  journeyId: string;
  date: string;
  catalog: SalesCatalogItem[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const itemKey = useRef(1);
  const paymentKey = useRef(1);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [payments, setPayments] = useState<DraftPayment[]>([]);
  const [observation, setObservation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const totalCents = useMemo(
    () =>
      items.reduce((sum, item) => sum + item.quantity * cents(item.price), 0),
    [items],
  );
  const paidCents = useMemo(
    () => payments.reduce((sum, payment) => sum + cents(payment.amount), 0),
    [payments],
  );
  const remainingCents = totalCents - paidCents;
  const coverage =
    totalCents > 0 ? Math.max(0, Math.min((paidCents / totalCents) * 100, 100)) : 0;
  const balanced = totalCents > 0 && remainingCents === 0;
  const over = remainingCents < 0;
  const unitCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const usedSerials = useMemo(
    () =>
      new Set(
        items
          .map((item) => item.serial)
          .filter((serial): serial is string => Boolean(serial)),
      ),
    [items],
  );

  function addFromSearch() {
    const term = search.trim();
    if (!term) return;

    const normalized = term.replace(/\s+/g, "").toUpperCase();
    const serialProduct = catalog.find((product) =>
      product.serials.some(
        (serial) => serial.replace(/\s+/g, "").toUpperCase() === normalized,
      ),
    );

    if (serialProduct) {
      const serial = serialProduct.serials.find(
        (value) => value.replace(/\s+/g, "").toUpperCase() === normalized,
      )!;

      if (usedSerials.has(serial)) {
        setError("Ese IMEI/serie ya está agregado.");
        return;
      }

      setItems((current) => [
        ...current,
        {
          key: itemKey.current++,
          productId: serialProduct.productId,
          sku: serialProduct.sku,
          name: serialProduct.name,
          serial,
          serialized: true,
          serialOptions: serialProduct.serials,
          quantity: 1,
          available: 1,
          price: serialProduct.price.toFixed(2),
        },
      ]);
      setSearch("");
      setError("");
      return;
    }

    const product = catalog.find((candidate) => candidate.sku === term.toUpperCase());

    if (!product) {
      setError("No se encontró un SKU o IMEI disponible en Stock.");
      return;
    }

    if (product.serials.length > 0) {
      setItems((current) => [
        ...current,
        {
          key: itemKey.current++,
          productId: product.productId,
          sku: product.sku,
          name: product.name,
          serial: null,
          serialized: true,
          serialOptions: product.serials,
          quantity: 1,
          available: 1,
          price: product.price.toFixed(2),
        },
      ]);
    } else {
      const existing = items.find(
        (item) => item.productId === product.productId && !item.serialized,
      );

      if (existing) {
        setItems((current) =>
          current.map((item) =>
            item.key === existing.key
              ? {
                  ...item,
                  quantity: Math.min(item.quantity + 1, product.available),
                }
              : item,
          ),
        );
      } else {
        setItems((current) => [
          ...current,
          {
            key: itemKey.current++,
            productId: product.productId,
            sku: product.sku,
            name: product.name,
            serial: null,
            serialized: false,
            serialOptions: [],
            quantity: 1,
            available: product.available,
            price: product.price.toFixed(2),
          },
        ]);
      }
    }

    setSearch("");
    setError("");
  }

  function updateItem(key: number, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    );
  }

  function setQuantity(item: DraftItem, next: number) {
    updateItem(item.key, {
      quantity: Math.max(1, Math.min(next || 1, item.available)),
    });
  }

  function addPayment(method: SalePaymentMethod) {
    if (remainingCents <= 0) {
      setError("No existe saldo pendiente por asignar.");
      return;
    }

    setPayments((current) => [
      ...current,
      {
        key: paymentKey.current++,
        method,
        amount: fromCents(remainingCents),
        reference: "",
      },
    ]);
    setError("");
  }

  function updatePayment(key: number, patch: Partial<DraftPayment>) {
    setPayments((current) =>
      current.map((payment) =>
        payment.key === key ? { ...payment, ...patch } : payment,
      ),
    );
  }

  function setPaymentToRemaining(key: number) {
    const otherPaid = payments.reduce(
      (sum, payment) =>
        payment.key === key ? sum : sum + cents(payment.amount),
      0,
    );
    updatePayment(key, {
      amount: fromCents(Math.max(totalCents - otherPaid, 0)),
    });
  }

  async function saveSale() {
    setError("");

    if (items.length === 0) {
      setError("Agrega al menos un producto.");
      return;
    }
    if (items.some((item) => item.serialized && !item.serial)) {
      setError("Selecciona la serie/IMEI de todos los productos serializados.");
      return;
    }
    if (totalCents <= 0) {
      setError("La venta debe tener un importe mayor a cero.");
      return;
    }
    if (remainingCents !== 0) {
      setError("Los pagos deben sumar exactamente el total de la venta.");
      return;
    }

    setSaving(true);

    try {
      await postJson("/api/ventas/registrar", {
        journeyId,
        personId: staff.id,
        items: items.map((item) => ({
          producto_id: item.productId,
          serial: item.serial,
          cantidad: item.quantity,
          precio_unitario: cents(item.price) / 100,
        })),
        payments: payments.map((payment) => ({
          metodo: payment.method,
          monto: cents(payment.amount) / 100,
          referencia: payment.reference.trim() || null,
        })),
        observation: observation.trim() || undefined,
      });

      onSaved();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "No se pudo registrar la venta.",
      );
    } finally {
      setSaving(false);
    }
  }

  const fieldLabel = "mb-1 block text-[11px] font-medium text-slate-400";

  return (
    <Modal
      open
      title="Nueva venta"
      description={"Registrando para: " + staff.name + " · " + formatDate(date)}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
    >
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ───────── Columna principal ───────── */}
        <div className="min-w-0 space-y-7">
          <section>
            <SectionTitle
              aside={
                <span className="text-xs tabular-nums text-slate-400">
                  {items.length} {items.length === 1 ? "producto" : "productos"}
                </span>
              }
            >
              Productos
            </SectionTitle>

            <div className="flex gap-2">
              <label className="relative min-w-0 flex-1">
                <FontAwesomeIcon
                  icon={faQrcode}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs text-slate-400"
                />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addFromSearch();
                    }
                  }}
                  placeholder="Buscar SKU o escanear IMEI"
                  className="control-input h-11 pl-10 text-sm"
                />
              </label>
              <button
                type="button"
                onClick={addFromSearch}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98]"
              >
                <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                Agregar
              </button>
            </div>

            <div className="mt-3 space-y-2.5">
              {items.map((item) => (
                <div
                  key={item.key}
                  className="rounded-xl border border-slate-200 bg-white p-3.5 transition-shadow hover:shadow-[0_6px_18px_-12px_rgba(15,23,42,0.25)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {item.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-400">
                        {item.sku}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setItems((current) =>
                          current.filter((row) => row.key !== item.key),
                        )
                      }
                      className="grid size-8 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                      aria-label="Quitar producto"
                    >
                      <FontAwesomeIcon icon={faTrash} className="text-xs" />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.3fr)_auto_110px_auto] sm:items-end">
                    <div>
                      <span className={fieldLabel}>Serie / IMEI</span>
                      {item.serialized ? (
                        <select
                          value={item.serial ?? ""}
                          onChange={(event) =>
                            updateItem(item.key, {
                              serial: event.target.value || null,
                            })
                          }
                          className={
                            "control-input h-9 w-full text-xs " +
                            (!item.serial ? "border-amber-300" : "")
                          }
                        >
                          <option value="">Seleccionar serie</option>
                          {item.serialOptions.map((serial) => (
                            <option
                              key={serial}
                              value={serial}
                              disabled={
                                usedSerials.has(serial) && item.serial !== serial
                              }
                            >
                              {serial}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex h-9 items-center text-xs text-slate-400">
                          No aplica
                        </div>
                      )}
                    </div>

                    <div>
                      <span className={fieldLabel}>Cantidad</span>
                      {item.serialized ? (
                        <div className="flex h-9 items-center text-sm font-semibold tabular-nums text-slate-700">
                          1
                        </div>
                      ) : (
                        <div className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white">
                          <button
                            type="button"
                            onClick={() => setQuantity(item, item.quantity - 1)}
                            disabled={item.quantity <= 1}
                            className="grid h-full w-8 place-items-center text-slate-400 transition hover:text-slate-700 disabled:opacity-30"
                            aria-label="Restar"
                          >
                            <FontAwesomeIcon icon={faMinus} className="text-[10px]" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            max={item.available}
                            value={item.quantity}
                            onChange={(event) =>
                              setQuantity(item, Number(event.target.value))
                            }
                            className="h-full w-10 border-x border-slate-100 bg-transparent text-center text-sm font-semibold tabular-nums text-slate-800 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            type="button"
                            onClick={() => setQuantity(item, item.quantity + 1)}
                            disabled={item.quantity >= item.available}
                            className="grid h-full w-8 place-items-center text-slate-400 transition hover:text-slate-700 disabled:opacity-30"
                            aria-label="Sumar"
                          >
                            <FontAwesomeIcon icon={faPlus} className="text-[10px]" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div>
                      <span className={fieldLabel}>Precio</span>
                      <div className="relative">
                        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          S/
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(event) =>
                            updateItem(item.key, { price: event.target.value })
                          }
                          className="control-input h-9 w-full pl-7 text-right text-sm tabular-nums"
                        />
                      </div>
                    </div>

                    <div className="text-right sm:min-w-24">
                      <span className={fieldLabel}>Subtotal</span>
                      <p className="flex h-9 items-center justify-end text-sm font-semibold tabular-nums text-slate-900">
                        {money((item.quantity * cents(item.price)) / 100)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {items.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center">
                  <span className="grid size-10 place-items-center rounded-full bg-slate-50 text-slate-300">
                    <FontAwesomeIcon icon={faBoxOpen} />
                  </span>
                  <p className="text-sm text-slate-400">
                    Agrega productos por SKU o IMEI.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <SectionTitle>Medios de pago</SectionTitle>

            <div className="flex flex-wrap gap-2">
              {(Object.keys(paymentLabels) as SalePaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => addPayment(method)}
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-slate-200 bg-white pl-1.5 pr-3.5 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]"
                >
                  <span
                    className={
                      "grid size-6 place-items-center rounded-full " +
                      paymentMeta[method].tile
                    }
                  >
                    <FontAwesomeIcon
                      icon={paymentMeta[method].icon}
                      className="text-[10px]"
                    />
                  </span>
                  {paymentLabels[method]}
                </button>
              ))}
            </div>

            <div className="mt-3 space-y-2">
              {payments.map((payment) => (
                <div
                  key={payment.key}
                  className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white p-2.5 sm:flex-nowrap"
                >
                  <span
                    className={
                      "grid size-9 shrink-0 place-items-center rounded-lg " +
                      paymentMeta[payment.method].tile
                    }
                  >
                    <FontAwesomeIcon
                      icon={paymentMeta[payment.method].icon}
                      className="text-xs"
                    />
                  </span>

                  <select
                    value={payment.method}
                    onChange={(event) =>
                      updatePayment(payment.key, {
                        method: event.target.value as SalePaymentMethod,
                      })
                    }
                    className="control-input h-9 w-36 shrink-0 text-sm"
                  >
                    {(Object.keys(paymentLabels) as SalePaymentMethod[]).map(
                      (method) => (
                        <option key={method} value={method}>
                          {paymentLabels[method]}
                        </option>
                      ),
                    )}
                  </select>

                  <div className="relative w-32 shrink-0">
                    <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                      S/
                    </span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={payment.amount}
                      onChange={(event) =>
                        updatePayment(payment.key, { amount: event.target.value })
                      }
                      className="control-input h-9 w-full pl-7 text-right text-sm tabular-nums"
                    />
                  </div>

                  <input
                    value={payment.reference}
                    onChange={(event) =>
                      updatePayment(payment.key, { reference: event.target.value })
                    }
                    placeholder="Referencia (opcional)"
                    className="control-input h-9 min-w-0 flex-1 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => setPaymentToRemaining(payment.key)}
                    title="Completar con el saldo exacto"
                    aria-label="Saldo exacto"
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-400 transition hover:bg-indigo-50 hover:text-indigo-600"
                  >
                    <FontAwesomeIcon icon={faBullseye} className="text-xs" />
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setPayments((current) =>
                        current.filter((row) => row.key !== payment.key),
                      )
                    }
                    className="grid size-9 shrink-0 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-500"
                    aria-label="Quitar pago"
                  >
                    <FontAwesomeIcon icon={faTrash} className="text-xs" />
                  </button>
                </div>
              ))}

              {payments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-center text-xs text-slate-400">
                  Elige un medio de pago para asignar el saldo.
                </p>
              ) : null}
            </div>
          </section>
        </div>

        {/* ───────── Resumen lateral ───────── */}
        <aside className="lg:sticky lg:top-0 lg:self-start">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <div>
              <p className="text-xs text-slate-400">Total de la venta</p>
              <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-slate-900">
                {money(totalCents / 100)}
              </p>
              <p className="mt-1 text-xs text-slate-400">
                {unitCount} {unitCount === 1 ? "unidad" : "unidades"} ·{" "}
                {items.length} {items.length === 1 ? "producto" : "productos"}
              </p>
            </div>

            <div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200/70">
                <div
                  className={
                    "h-full rounded-full transition-[width,background-color] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] " +
                    (over
                      ? "bg-rose-500"
                      : balanced
                        ? "bg-emerald-500"
                        : "bg-amber-400")
                  }
                  style={{ width: coverage + "%" }}
                />
              </div>

              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">Pagado</dt>
                  <dd className="font-medium tabular-nums text-slate-800">
                    {money(paidCents / 100)}
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-slate-500">
                    {over ? "Excedente" : "Pendiente"}
                  </dt>
                  <dd
                    className={
                      "font-semibold tabular-nums transition-colors duration-500 " +
                      (over
                        ? "text-rose-600"
                        : balanced
                          ? "text-emerald-600"
                          : "text-amber-600")
                    }
                  >
                    {money(Math.abs(remainingCents) / 100)}
                  </dd>
                </div>
              </dl>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-500">
                Observación
              </span>
              <textarea
                value={observation}
                onChange={(event) => setObservation(event.target.value)}
                rows={2}
                maxLength={500}
                placeholder="Opcional"
                className="control-input min-h-20 w-full resize-none bg-white py-2 text-sm"
              />
            </label>

            {error ? (
              <div className="flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                <FontAwesomeIcon
                  icon={faCircleExclamation}
                  className="mt-0.5 text-[11px]"
                />
                <span>{error}</span>
              </div>
            ) : null}

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={
                  saving ||
                  items.length === 0 ||
                  totalCents <= 0 ||
                  remainingCents !== 0
                }
                onClick={saveSale}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:bg-slate-200 disabled:text-slate-400"
              >
                <FontAwesomeIcon icon={faCashRegister} className="text-xs" />
                {saving ? "Registrando..." : "Registrar venta"}
                {!saving ? (
                  <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                ) : null}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-full rounded-xl text-sm font-medium text-slate-500 transition hover:bg-slate-100"
              >
                Cancelar
              </button>
            </div>
          </div>
        </aside>
      </div>
    </Modal>
  );
}