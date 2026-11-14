"use client";

import { useMemo, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ActionMessage } from "@/components/ui/action-message";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  saveZoneWithManager,
  setZoneActive,
  type ZoneActionResult,
} from "@/features/administracion/server/zones-actions";
import type {
  ZoneListItem,
  ZonesManagementData,
} from "@/features/administracion/server/zones-loaders";

type ZoneForm = {
  id: string | null;
  codigo: string;
  descripcion: string;
  encargadoPersonaId: string;
};

const blank: ZoneForm = {
  id: null,
  codigo: "",
  descripcion: "",
  encargadoPersonaId: "",
};
const initialMessage: ZoneActionResult = { ok: false, message: "" };

/* ---------- Piezas pequeñas ---------- */

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "green" | "amber" | "blue" | "slate";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
    slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join("")
    .toUpperCase();
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-xs font-semibold text-white shadow-sm">
      {initials || "?"}
    </span>
  );
}

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/* ---------- Vista principal ---------- */

export function ZonesManagement({ data }: { data: ZonesManagementData }) {
  const router = useRouter();
  const [form, setForm] = useState<ZoneForm>(blank);
  const [formOpen, setFormOpen] = useState(false);
  const [message, setMessage] = useState<ZoneActionResult>(initialMessage);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [confirmZone, setConfirmZone] = useState<ZoneListItem | null>(null);
  const [pending, startTransition] = useTransition();

  const stats = useMemo(
    () => ({
      total: data.zones.length,
      activas: data.zones.filter((z) => z.isActive).length,
      inactivas: data.zones.filter((z) => !z.isActive).length,
      sinEncargado: data.zones.filter((z) => z.isActive && !z.encargadoNombre)
        .length,
    }),
    [data.zones],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es");
    return data.zones.filter((zone) => {
      if (!showInactive && !zone.isActive) return false;
      const value = (
        zone.codigo +
        " " +
        zone.descripcion +
        " " +
        (zone.encargadoNombre ?? "")
      ).toLocaleLowerCase("es");
      return value.includes(term);
    });
  }, [data.zones, search, showInactive]);

  function openCreate() {
    setForm(blank);
    setMessage(initialMessage);
    setFormOpen(true);
  }

  function openEdit(zone: ZoneListItem) {
    setForm({
      id: zone.id,
      codigo: zone.codigo,
      descripcion: zone.descripcion,
      encargadoPersonaId: zone.encargadoPersonaId ?? "",
    });
    setMessage(initialMessage);
    setFormOpen(true);
  }

  function closeForm() {
    if (pending) return;
    setFormOpen(false);
    setForm(blank);
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    startTransition(async () => {
      try {
        const response = await saveZoneWithManager(form);
        setMessage(response);
        if (response.ok) {
          setFormOpen(false);
          setForm(blank);
          router.refresh();
        }
      } catch {
        setMessage({
          ok: false,
          message: "No se pudo guardar la zona. Revisa tu sesión.",
        });
      }
    });
  }

  function changeStatus(zone: ZoneListItem) {
    if (pending) return;
    startTransition(async () => {
      try {
        const response = await setZoneActive({
          id: zone.id,
          active: !zone.isActive,
        });
        setMessage(response);
        setConfirmZone(null);
        if (response.ok) {
          if (form.id === zone.id) setForm(blank);
          router.refresh();
        }
      } catch {
        setMessage({ ok: false, message: "No se pudo actualizar el estado." });
        setConfirmZone(null);
      }
    });
  }

  const missingManager =
    Boolean(form.encargadoPersonaId) &&
    !data.managers.some((person) => person.id === form.encargadoPersonaId);
  const existingManager = missingManager
    ? data.zones.find((zone) => zone.id === form.id)?.encargadoNombre
    : null;

  const canSubmit =
    !pending && data.migrationReady && data.managers.length > 0;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      {/* Encabezado */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Zonas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Crea y edita zonas con su encargado Zonal.
          </p>
        </div>
        <Button type="button" onClick={openCreate} disabled={pending}>
          + Nueva zona
        </Button>
      </header>

      {data.error && (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {data.error} El guardado permanecerá deshabilitado hasta aplicar la
          migración.
        </div>
      )}

      {/* Mensaje (solo cuando el modal está cerrado) */}
      {message.message && !formOpen && <ActionMessage state={message} />}

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-slate-900" },
          { label: "Activas", value: stats.activas, color: "text-emerald-600" },
          { label: "Inactivas", value: stats.inactivas, color: "text-slate-500" },
          {
            label: "Sin encargado",
            value: stats.sinEncargado,
            color: stats.sinEncargado ? "text-amber-600" : "text-slate-900",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {s.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${s.color}`}>
              {s.value}
            </p>
          </div>
        ))}
      </div>

      {/* Tabla */}
      <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative w-full sm:max-w-sm">
            <span className="sr-only">Buscar zonas</span>
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input
              className="control-input w-full !pl-9"
              placeholder="Buscar código, descripción o encargado..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Mostrar inactivas
          </label>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Descripción</th>
                <th className="px-4 py-3 font-medium">Encargado Zonal</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((zone) => (
                <tr
                  key={zone.id}
                  className={`transition hover:bg-slate-50/70 ${
                    zone.isActive ? "" : "opacity-70"
                  }`}
                >
                  <td className="px-4 py-3">
                    <Badge tone="blue">{zone.codigo}</Badge>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {zone.descripcion}
                  </td>
                  <td className="px-4 py-3">
                    {zone.encargadoNombre ? (
                      <div className="flex items-center gap-2.5">
                        <Avatar name={zone.encargadoNombre} />
                        <span className="text-slate-700">
                          {zone.encargadoNombre}
                        </span>
                      </div>
                    ) : (
                      <Badge tone="amber">Sin encargado</Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={zone.isActive ? "green" : "slate"}>
                      {zone.isActive ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => openEdit(zone)}
                        className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => setConfirmZone(zone)}
                        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                          zone.isActive
                            ? "text-rose-600 hover:bg-rose-50"
                            : "text-emerald-600 hover:bg-emerald-50"
                        }`}
                      >
                        {zone.isActive ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {search || data.zones.length > 0
                        ? "No hay zonas que coincidan con los filtros"
                        : "Aún no hay zonas registradas"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {search || data.zones.length > 0
                        ? "Prueba con otra búsqueda o muestra las inactivas."
                        : "Crea la primera con el botón “Nueva zona”."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          {filtered.length} de {data.zones.length} zonas
        </p>
      </section>

      {/* Modal crear / editar */}
      <Modal
        open={formOpen}
        title={form.id ? "Editar zona" : "Nueva zona"}
        onClose={closeForm}
      >
        <form onSubmit={submit} className="space-y-5">
          {message.message && !message.ok && <ActionMessage state={message} />}

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <Field label="Código *">
                <input
                  name="codigo"
                  className="control-input w-full"
                  required
                  maxLength={30}
                  value={form.codigo}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      codigo: e.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="ZN001"
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Encargado Zonal *">
                <select
                  name="encargado"
                  className="control-input w-full"
                  value={form.encargadoPersonaId}
                  required
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      encargadoPersonaId: e.target.value,
                    }))
                  }
                >
                  <option value="">Seleccionar persona Zonal</option>
                  {missingManager && (
                    <option value={form.encargadoPersonaId}>
                      {existingManager || "Encargado actual no elegible"}{" "}
                      (revisar autorización)
                    </option>
                  )}
                  {data.managers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.nombre +
                        (manager.documento ? " · " + manager.documento : "")}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="sm:col-span-3">
              <Field
                label="Descripción *"
                hint="Nombre o detalle de la zona, hasta 500 caracteres."
              >
                <textarea
                  name="descripcion"
                  className="control-input w-full"
                  rows={3}
                  required
                  maxLength={500}
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      descripcion: e.target.value,
                    }))
                  }
                  placeholder="Zona Norte"
                />
              </Field>
            </div>
          </div>

          {data.managers.length === 0 && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              No hay personas activas con puesto y rol Zonal autorizado.
              Registra o autoriza primero una persona desde Personal.
            </p>
          )}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={closeForm}
              disabled={pending}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              Cancelar
            </button>
            <Button type="submit" disabled={!canSubmit}>
              {pending
                ? "Guardando..."
                : form.id
                  ? "Guardar cambios"
                  : "Crear zona"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal confirmación activar / desactivar */}
      <Modal
        open={confirmZone !== null}
        title={confirmZone?.isActive ? "Desactivar zona" : "Reactivar zona"}
        onClose={() => !pending && setConfirmZone(null)}
      >
        {confirmZone && (
          <div className="space-y-5">
            <p className="text-sm text-slate-600">
              {confirmZone.isActive ? (
                <>
                  La zona <strong>{confirmZone.codigo}</strong> se desactivará
                  sin borrar su historial. Podrás reactivarla cuando quieras.
                </>
              ) : (
                <>
                  ¿Reactivar la zona <strong>{confirmZone.codigo}</strong>?
                </>
              )}
            </p>
            <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setConfirmZone(null)}
                disabled={pending}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancelar
              </button>
              <Button
                type="button"
                disabled={pending}
                onClick={() => changeStatus(confirmZone)}
              >
                {pending
                  ? "Procesando..."
                  : confirmZone.isActive
                    ? "Desactivar"
                    : "Reactivar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}