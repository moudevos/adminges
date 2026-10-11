"use client";

import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";
import { createPerson, type PersonActionState } from "@/app/dashboard/person-actions";

type PuestoRow = {
  id: string;
  nombre: string;
};

type PersonaRow = {
  id: string;
  puesto_id: string;
  nombres: string;
  apellidos: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  is_active: boolean;
};

type Props = {
  personas: PersonaRow[];
  puestos: PuestoRow[];
};

const initialState: PersonActionState = { ok: false, message: "" };

export function PersonalManagement({ personas, puestos }: Props) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createPerson, initialState);
  const puestosMap = useMemo(
    () => new Map(puestos.map((puesto) => [puesto.id, puesto.nombre])),
    [puestos],
  );

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <>
      {state.message && <ActionMessage state={state} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Personal</h2>
            <p className="mt-1 text-xs text-slate-500">{personas.length} personas registradas</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={puestos.length === 0}
            className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-40"
          >
            Agregar persona
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Puesto</th>
                <th className="px-5 py-3 font-medium">Teléfono</th>
                <th className="px-5 py-3 font-medium">Correo</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {personas.map((persona) => (
                <tr key={persona.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {persona.nombres} {persona.apellidos}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{persona.documento || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{puestosMap.get(persona.puesto_id) || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{persona.telefono || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{persona.email || "—"}</td>
                  <td className="px-5 py-4">
                    <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      {persona.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
              {personas.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-slate-400">
                    Todavía no hay personal registrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal open={open} onClose={() => !pending && setOpen(false)}>
        <form action={action} className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-950">Agregar persona</h2>
            <p className="mt-1 text-sm text-slate-500">
              El personal no crea usuarios de acceso. Las ventas se enlazarán a estas personas.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombres" name="nombres" required />
            <Field label="Apellidos" name="apellidos" required />
            <Field label="Documento" name="documento" />
            <Field label="Teléfono" name="telefono" />
            <Field label="Correo" name="email" type="email" />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Puesto</span>
              <select name="puesto_id" required defaultValue="" className="control-input">
                <option value="" disabled>Selecciona un puesto</option>
                {puestos.map((puesto) => (
                  <option key={puesto.id} value={puesto.id}>{puesto.nombre}</option>
                ))}
              </select>
            </label>
          </div>
          {!state.ok && state.message && <ActionMessage state={state} />}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
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
              {pending ? "Guardando..." : "Agregar"}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} required={required} className="control-input" />
    </label>
  );
}

function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm">
      <button type="button" aria-label="Cerrar modal" className="absolute inset-0" onClick={onClose} />
      <section className="relative z-10 w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
        {children}
      </section>
    </div>
  );
}

function ActionMessage({ state }: { state: PersonActionState }) {
  return (
    <div className={`mb-4 rounded-xl border px-4 py-3 text-sm ${
      state.ok
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : "border-rose-200 bg-rose-50 text-rose-700"
    }`}>
      {state.message}
    </div>
  );
}
