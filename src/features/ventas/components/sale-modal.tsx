"use client";

import {
  faArrowRight,
  faCashRegister,
  faCreditCard,
  faMoneyBillWave,
  faQrcode,
  faTrash,
  faWallet,
} from "@fortawesome/free-solid-svg-icons";
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
      items.reduce(
        (sum, item) => sum + item.quantity * cents(item.price),
        0,
      ),
    [items],
  );
  const paidCents = useMemo(
    () => payments.reduce((sum, payment) => sum + cents(payment.amount), 0),
    [payments],
  );
  const remainingCents = totalCents - paidCents;

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

  return (
    <Modal
      open
      title="Nueva venta"
      description={"Registrando para: " + staff.name + " · " + formatDate(date)}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
    >
      <div className="space-y-5">
        {error ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
            {error}
          </div>
        ) : null}

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
              Detalle de items
            </p>
            <span className="text-sm font-semibold text-indigo-600">
              Total: {money(totalCents / 100)}
            </span>
          </div>

          <div className="flex gap-2">
            <label className="relative min-w-0 flex-1">
              <FontAwesomeIcon
                icon={faQrcode}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400"
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
                className="control-input h-10 pl-9 text-sm"
              />
            </label>
            <button
              type="button"
              onClick={addFromSearch}
              className="h-10 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Agregar
            </button>
          </div>

          <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="bg-slate-50 text-left text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">SKU / Producto</th>
                  <th className="px-3 py-2.5">Serie</th>
                  <th className="px-3 py-2.5 text-right">Cant.</th>
                  <th className="px-3 py-2.5 text-right">Precio</th>
                  <th className="px-3 py-2.5 text-right">Subtotal</th>
                  <th className="w-10 px-2 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.key} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <p className="font-medium text-slate-900">{item.name}</p>
                      <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                        {item.sku}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      {item.serialized ? (
                        <select
                          value={item.serial ?? ""}
                          onChange={(event) =>
                            updateItem(item.key, {
                              serial: event.target.value || null,
                            })
                          }
                          className="control-input h-9 min-w-44 text-xs"
                        >
                          <option value="">Seleccionar serie</option>
                          {item.serialOptions.map((serial) => (
                            <option
                              key={serial}
                              value={serial}
                              disabled={
                                usedSerials.has(serial) &&
                                item.serial !== serial
                              }
                            >
                              {serial}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">No aplica</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right">
                      {item.serialized ? (
                        <span className="font-semibold tabular-nums">1</span>
                      ) : (
                        <input
                          type="number"
                          min={1}
                          max={item.available}
                          value={item.quantity}
                          onChange={(event) =>
                            updateItem(item.key, {
                              quantity: Math.max(
                                1,
                                Math.min(
                                  Number(event.target.value) || 1,
                                  item.available,
                                ),
                              ),
                            })
                          }
                          className="control-input ml-auto h-9 w-20 text-right text-sm"
                        />
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.price}
                        onChange={(event) =>
                          updateItem(item.key, { price: event.target.value })
                        }
                        className="control-input ml-auto h-9 w-28 text-right text-sm"
                      />
                    </td>
                    <td className="px-3 py-3 text-right font-semibold tabular-nums text-slate-800">
                      {money((item.quantity * cents(item.price)) / 100)}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          setItems((current) =>
                            current.filter((row) => row.key !== item.key),
                          )
                        }
                        className="grid size-8 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label="Quitar producto"
                      >
                        <FontAwesomeIcon icon={faTrash} className="text-xs" />
                      </button>
                    </td>
                  </tr>
                ))}

                {items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-400">
                      Agrega productos por SKU o IMEI.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-slate-500">
              Medios de pago
            </p>
            <div className="text-xs text-slate-500">
              Pagado: <b>{money(paidCents / 100)}</b> · Pendiente:{" "}
              <b className={remainingCents === 0 ? "text-emerald-600" : "text-amber-600"}>
                {money(remainingCents / 100)}
              </b>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-2">
            {(Object.keys(paymentLabels) as SalePaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                onClick={() => addPayment(method)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
              >
                <FontAwesomeIcon
                  icon={
                    method === "efectivo"
                      ? faMoneyBillWave
                      : method === "tarjeta"
                        ? faCreditCard
                        : faWallet
                  }
                  className="text-[10px]"
                />
                {paymentLabels[method]}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.key}
                className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50/60 p-2 sm:grid-cols-[150px_130px_1fr_auto_auto]"
              >
                <select
                  value={payment.method}
                  onChange={(event) =>
                    updatePayment(payment.key, {
                      method: event.target.value as SalePaymentMethod,
                    })
                  }
                  className="control-input h-9 text-sm"
                >
                  {(Object.keys(paymentLabels) as SalePaymentMethod[]).map((method) => (
                    <option key={method} value={method}>
                      {paymentLabels[method]}
                    </option>
                  ))}
                </select>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={payment.amount}
                  onChange={(event) =>
                    updatePayment(payment.key, { amount: event.target.value })
                  }
                  className="control-input h-9 text-right text-sm"
                />

                <input
                  value={payment.reference}
                  onChange={(event) =>
                    updatePayment(payment.key, {
                      reference: event.target.value,
                    })
                  }
                  placeholder="Referencia opcional"
                  className="control-input h-9 text-sm"
                />

                <button
                  type="button"
                  onClick={() => setPaymentToRemaining(payment.key)}
                  className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-600"
                >
                  Saldo exacto
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPayments((current) =>
                      current.filter((row) => row.key !== payment.key),
                    )
                  }
                  className="grid size-9 place-items-center rounded-lg text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                  aria-label="Quitar pago"
                >
                  <FontAwesomeIcon icon={faTrash} className="text-xs" />
                </button>
              </div>
            ))}
          </div>
        </section>

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
            className="control-input min-h-20 resize-none py-2 text-sm"
          />
        </label>

        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            Total{" "}
            <span className="ml-1 text-lg font-bold text-slate-900">
              {money(totalCents / 100)}
            </span>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={
                saving ||
                items.length === 0 ||
                totalCents <= 0 ||
                remainingCents !== 0
              }
              onClick={saveSale}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-5 text-sm font-semibold text-white disabled:bg-slate-200 disabled:text-slate-400"
            >
              <FontAwesomeIcon icon={faCashRegister} className="text-xs" />
              {saving ? "Registrando..." : "Registrar venta"}
              {!saving ? <FontAwesomeIcon icon={faArrowRight} className="text-xs" /> : null}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
