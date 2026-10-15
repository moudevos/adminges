"use client";

import {
  faArrowLeft,
  faRotateLeft,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { SaleHistoryDetailData } from "@/features/ventas/domain/types";

function money(value: number) {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "PEN",
  }).format(value);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function SaleHistoryDetail({
  data,
}: {
  data: SaleHistoryDetailData;
}) {
  const router = useRouter();
  const [reverseOpen, setReverseOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!data.schemaReady) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        {data.schemaMessage}
      </section>
    );
  }

  if (!data.sale) return null;

  const sale = data.sale;

  async function reverse() {
    if (reason.trim().length < 3) {
      setError("Ingresa el motivo de la reversa.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch("/api/ventas/" + sale.id + "/reversar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const payload = (await response.json()) as { message?: string };

      if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo anular la venta.");
      }

      setReverseOpen(false);
      setReason("");
      router.refresh();
    } catch (reverseError) {
      setError(
        reverseError instanceof Error
          ? reverseError.message
          : "No se pudo anular la venta.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">
              Venta · {dateTime(sale.date)}
            </h1>
            <span
              className={
                "rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide " +
                (sale.status === "confirmada"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-rose-50 text-rose-700")
              }
            >
              {sale.status === "confirmada" ? "Confirmada" : "Anulada"}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {sale.promoterName} · {sale.units} unidades · {money(sale.total)}
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/ventas/historial"
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-600"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="text-xs" />
            Histórico
          </Link>

          {sale.status === "confirmada" ? (
            <button
              type="button"
              onClick={() => setReverseOpen(true)}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700"
            >
              <FontAwesomeIcon icon={faRotateLeft} className="text-xs" />
              Reversar
            </button>
          ) : null}
        </div>
      </section>

      {sale.status === "anulada" ? (
        <section className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">
            Venta anulada
          </p>
          <p className="mt-2 text-sm text-rose-900">
            {sale.reversalReason || "Sin motivo registrado"}
          </p>
          {sale.reversedAt ? (
            <p className="mt-1 text-xs text-rose-600">
              {dateTime(sale.reversedAt)}
            </p>
          ) : null}
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-800">Productos</h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="bg-slate-50/70 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">SKU / Producto</th>
                <th className="px-4 py-3">Serie / IMEI</th>
                <th className="px-4 py-3">Categoría / Tipo</th>
                <th className="px-4 py-3 text-right">Cant.</th>
                <th className="px-4 py-3 text-right">Precio</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100">
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    <p className="mt-0.5 font-mono text-[10px] text-slate-400">
                      {item.sku}
                    </p>
                    {item.scPlusLabelPrice !== null ? (
                      <p className="mt-1 text-xs text-indigo-700">
                        SC+ intangible · Precio etiqueta equipo: {money(item.scPlusLabelPrice)}
                        {item.scPlusRelatedDeviceId ? " · Equipo vinculado" : ""}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-slate-500">
                    {item.serial || "No aplica"}
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="text-xs text-slate-700">{item.category || "—"}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      {item.type || "Sin tipo"}
                    </p>
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3.5 text-right tabular-nums">
                    {money(item.unitPrice)}
                  </td>
                  <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-slate-900">
                    {money(item.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Pagos</h2>
          <div className="mt-3 divide-y divide-slate-100">
            {data.payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0"
              >
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {payment.methodName}
                  </p>
                  <p className="mt-0.5 text-[10px] text-slate-400">
                    {payment.reference || "Sin referencia"}
                  </p>
                </div>
                <span className="font-semibold tabular-nums text-slate-900">
                  {money(payment.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Observación</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {sale.observation || "Sin observaciones."}
          </p>
        </section>
      </div>

      <Modal
        open={reverseOpen}
        title="Reversar venta"
        description="La venta se anulará. Solo los productos físicos restituyen stock; SC+ no genera movimientos de Kardex."
        onClose={() => {
          if (!busy) setReverseOpen(false);
        }}
        maxWidthClassName="max-w-md"
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">
              Motivo
            </span>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={500}
              placeholder="Ej. venta registrada por error, devolución inmediata..."
              className="control-input min-h-28 resize-none py-2 text-sm"
            />
          </label>

          <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-800">
            Esta acción queda auditada y no puede aplicarse dos veces sobre la
            misma venta.
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => setReverseOpen(false)}
              className="h-10 rounded-lg border border-slate-200 px-4 text-sm font-medium text-slate-600"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={busy || reason.trim().length < 3}
              onClick={reverse}
              className="h-10 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Reversando..." : "Confirmar reversa"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
