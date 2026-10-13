"use client";

import { faPlus, faTrash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import type { PaymentMethodOption } from "@/features/ventas/domain/types";

async function request(
  method: "POST" | "PATCH" | "DELETE",
  body: unknown,
) {
  const response = await fetch("/api/ventas/metodos-pago", {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = (await response.json()) as {
    message?: string;
  };

  if (!response.ok) {
    throw new Error(payload.message ?? "No se pudo completar la operación.");
  }

  return payload;
}

export function PaymentMethodsModal({
  open,
  methods,
  onClose,
}: {
  open: boolean;
  methods: PaymentMethodOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [requiresReference, setRequiresReference] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");

  async function run(label: string, action: () => Promise<{ message?: string }>) {
    setBusy(label);
    setMessage("");

    try {
      const result = await action();
      setMessage(result.message ?? "Cambios guardados.");
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar el cambio.",
      );
    } finally {
      setBusy("");
    }
  }

  async function add() {
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setMessage("Ingresa un nombre válido.");
      return;
    }

    await run("Agregando...", async () => {
      const result = await request("POST", {
        name: trimmed,
        requiresReference,
      });
      setName("");
      setRequiresReference(false);
      return result;
    });
  }

  return (
    <Modal
      open={open}
      title="Métodos de pago"
      description="Define qué opciones estarán disponibles al registrar una venta."
      onClose={onClose}
      maxWidthClassName="max-w-xl"
    >
      <div className="space-y-4">
        {message ? (
          <div className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
            {message}
          </div>
        ) : null}

        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nuevo método de pago"
            maxLength={80}
            className="control-input h-10 text-sm"
          />

          <label className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={requiresReference}
              onChange={(event) => setRequiresReference(event.target.checked)}
              className="size-4 accent-indigo-600"
            />
            Referencia
          </label>

          <button
            type="button"
            disabled={Boolean(busy)}
            onClick={add}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-50"
          >
            <FontAwesomeIcon icon={faPlus} className="text-xs" />
            Agregar
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200">
          {methods.map((method) => (
            <div
              key={method.id}
              className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 last:border-b-0"
            >
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  run(
                    method.active ? "Desactivando..." : "Activando...",
                    () =>
                      request("PATCH", {
                        id: method.id,
                        active: !method.active,
                      }),
                  )
                }
                className={
                  "relative h-6 w-11 shrink-0 rounded-full transition " +
                  (method.active ? "bg-indigo-600" : "bg-slate-200")
                }
                aria-label={
                  method.active
                    ? "Desactivar " + method.name
                    : "Activar " + method.name
                }
              >
                <span
                  className={
                    "absolute top-1 size-4 rounded-full bg-white transition-all " +
                    (method.active ? "left-6" : "left-1")
                  }
                />
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">
                  {method.name}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-400">
                  {method.active ? "Disponible en ventas" : "Oculto en ventas"}
                  {method.requiresReference ? " · referencia habilitada" : ""}
                </p>
              </div>

              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() =>
                  run("Quitando...", () =>
                    request("DELETE", { id: method.id }),
                  )
                }
                className="grid size-8 place-items-center rounded-lg text-slate-300 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                aria-label={"Quitar " + method.name}
                title={
                  method.system
                    ? "Se desactivará para conservar compatibilidad histórica"
                    : "Quitar método"
                }
              >
                <FontAwesomeIcon icon={faTrash} className="text-xs" />
              </button>
            </div>
          ))}

          {methods.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-400">
              No hay métodos configurados.
            </div>
          ) : null}
        </div>

        <p className="text-[11px] leading-5 text-slate-400">
          Si un método ya fue usado en una venta, “Quitar” lo desactiva en vez
          de borrarlo para conservar el histórico.
        </p>
      </div>
    </Modal>
  );
}
