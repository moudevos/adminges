"use client";

import { type FormEvent, useMemo, useState, useTransition } from "react";
import {
  createPerson,
  type PersonActionState,
} from "@/app/dashboard/person-actions";
import { ActionMessage } from "@/components/ui/action-message";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/form-field";
import { Modal } from "@/components/ui/modal";

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
  const [state, setState] = useState<PersonActionState>(initialState);
  const [pending, startTransition] = useTransition();

  const puestosMap = useMemo(
    () => new Map(puestos.map((puesto) => [puesto.id, puesto.nombre])),
    [puestos],
  );

  function submitPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      const result = await createPerson(initialState, formData);
      setState(result);

      if (result.ok) {
        form.reset();
        setOpen(false);
      }
    });
  }

  return (
    <>
      {state.message ? <ActionMessage state={state} className="mb-4" /> : null}

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-slate-900">Personal</h2>
            <p className="mt-1 text-xs text-slate-500">
              {personas.length} personas registradas
            </p>
          </div>

          <Button
            onClick={() => setOpen(true)}
            disabled={puestos.length === 0}
          >
            Agregar persona
          </Button>
        </div>

        <div className="overflow-x-auto p-2">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="text-xs font-semibold text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-3 py-3">Persona</th>
                <th className="border-b border-slate-200 px-3 py-3">Documento</th>
                <th className="border-b border-slate-200 px-3 py-3">Puesto</th>
                <th className="border-b border-slate-200 px-3 py-3">Teléfono</th>
                <th className="border-b border-slate-200 px-3 py-3">Correo</th>
                <th className="border-b border-slate-200 px-3 py-3">Estado</th>
              </tr>
            </thead>

            <tbody>
              {personas.map((persona) => (
                <tr key={persona.id} className="transition hover:bg-slate-50">
                  <td className="border-b border-slate-100 px-3 py-3.5 font-medium text-slate-900">
                    {persona.nombres} {persona.apellidos}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                    {persona.documento || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                    {puestosMap.get(persona.puesto_id) || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                    {persona.telefono || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5 text-slate-600">
                    {persona.email || "—"}
                  </td>
                  <td className="border-b border-slate-100 px-3 py-3.5">
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                        persona.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {persona.is_active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}

              {personas.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-5 py-10 text-center text-slate-400"
                  >
                    Todavía no hay personal registrado.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        title="Agregar persona"
        description="El personal no crea usuarios de acceso. Las ventas se enlazarán a estas personas."
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      >
        <form onSubmit={submitPerson} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <InputField label="Nombres" name="nombres" required />
            <InputField label="Apellidos" name="apellidos" required />
            <InputField label="Documento" name="documento" />
            <InputField label="Teléfono" name="telefono" />
            <InputField label="Correo" name="email" type="email" />

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">
                Puesto
              </span>
              <select
                name="puesto_id"
                required
                defaultValue=""
                className="control-input"
              >
                <option value="" disabled>
                  Selecciona un puesto
                </option>
                {puestos.map((puesto) => (
                  <option key={puesto.id} value={puesto.id}>
                    {puesto.nombre}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!state.ok && state.message ? <ActionMessage state={state} /> : null}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <Button
              variant="secondary"
              onClick={() => setOpen(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Agregar"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
