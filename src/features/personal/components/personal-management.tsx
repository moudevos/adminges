"use client";

import { useMemo, useState, useTransition } from "react";
import {
  createPerson,
  updatePerson,
  type PersonActionState,
} from "@/features/personal/server/actions";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";

type Person = {
  id: string;
  puesto_id: string;
  nombres: string;
  apellidos: string;
  documento: string | null;
  telefono: string | null;
  email: string | null;
  is_active: boolean;
  puede_vender: boolean;
  estado_laboral: "activo" | "vacaciones";
};

type Job = { id: string; nombre: string };

/* ---------- Piezas pequeñas ---------- */

function Badge({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "green" | "red" | "amber" | "blue" | "slate";
}) {
  const tones = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    red: "bg-rose-50 text-rose-700 ring-rose-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
    slate: "bg-slate-100 text-slate-600 ring-slate-500/20",
  };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function Avatar({ nombres, apellidos }: { nombres: string; apellidos: string }) {
  const initials = `${nombres.charAt(0)}${apellidos.charAt(0)}`.toUpperCase();
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-sm font-semibold text-white shadow-sm">
      {initials || "?"}
    </span>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function Switch({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-indigo-300 hover:bg-indigo-50/40 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
      />
      <span className="flex flex-col">
        <span className="text-sm font-medium text-slate-800">{label}</span>
        <span className="text-xs text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

/* ---------- Vista principal ---------- */

export function PersonalManagement({
  personas,
  puestos,
}: {
  personas: Person[];
  puestos: Job[];
}) {
  const [editing, setEditing] = useState<Person | null>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const puestoById = useMemo(
    () => new Map(puestos.map((j) => [j.id, j.nombre])),
    [puestos],
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return personas;
    return personas.filter((p) =>
      `${p.nombres} ${p.apellidos} ${p.documento ?? ""} ${p.telefono ?? ""}`
        .toLowerCase()
        .includes(term),
    );
  }, [personas, query]);

  const stats = useMemo(
    () => ({
      total: personas.length,
      activos: personas.filter((p) => p.is_active).length,
      vendedores: personas.filter((p) => p.puede_vender).length,
      vacaciones: personas.filter((p) => p.estado_laboral === "vacaciones")
        .length,
    }),
    [personas],
  );

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }

  function openEdit(p: Person) {
    setEditing(p);
    setOpen(true);
  }

  function save(ev: React.FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    const f = new FormData(ev.currentTarget);

    start(async () => {
      const v = {
        puesto_id: f.get("puesto_id"),
        nombres: f.get("nombres"),
        apellidos: f.get("apellidos"),
        documento: f.get("documento"),
        telefono: f.get("telefono"),
        email: f.get("email"),
        puede_vender: f.get("puede_vender") === "on",
        estado_laboral: f.get("estado_laboral"),
        role: f.get("role") || null,
        is_active: f.get("is_active") === "on",
      };

      const r: PersonActionState = editing
        ? await updatePerson({ personId: editing.id, ...v })
        : await createPerson({ ok: false, message: "" }, f);

      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) setOpen(false);
    });
  }

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
            Personal
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Administra a tu equipo, sus puestos y quién puede vender.
          </p>
        </div>
        <Button onClick={openCreate}>+ Nueva persona</Button>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Total", value: stats.total, color: "text-slate-900" },
          { label: "Activos", value: stats.activos, color: "text-emerald-600" },
          { label: "Pueden vender", value: stats.vendedores, color: "text-indigo-600" },
          { label: "De vacaciones", value: stats.vacaciones, color: "text-amber-600" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {s.label}
            </p>
            <p className={`mt-1 text-2xl font-semibold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Mensaje de resultado */}
      {message && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
            message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
          }`}
        >
          <span>{message.text}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            className="text-current opacity-60 hover:opacity-100"
            aria-label="Cerrar mensaje"
          >
            ✕
          </button>
        </div>
      )}

      {/* Tabla */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
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
              placeholder="Buscar por DNI, nombre o celular..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <p className="text-sm text-slate-500">
            {rows.length} {rows.length === 1 ? "persona" : "personas"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Persona</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                <th className="px-4 py-3 font-medium">Contacto</th>
                <th className="px-4 py-3 font-medium">Puesto</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((p) => (
                <tr key={p.id} className="transition hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar nombres={p.nombres} apellidos={p.apellidos} />
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">
                          {p.nombres} {p.apellidos}
                        </p>
                        {p.puede_vender && (
                          <span className="text-xs text-indigo-600">
                            Puede vender
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {p.documento || "—"}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-slate-700">{p.telefono || "—"}</p>
                    <p className="text-xs text-slate-500">{p.email || ""}</p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="blue">
                      {puestoById.get(p.puesto_id) ?? "Sin puesto"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={p.is_active ? "green" : "red"}>
                        {p.is_active ? "Activo" : "Inactivo"}
                      </Badge>
                      {p.estado_laboral === "vacaciones" && (
                        <Badge tone="amber">Vacaciones</Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openEdit(p)}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}

              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {query
                        ? "Sin resultados para tu búsqueda"
                        : "Aún no hay personas registradas"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {query
                        ? "Prueba con otro nombre, DNI o celular."
                        : "Crea la primera con el botón “Nueva persona”."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <Modal
        open={open}
        title={editing ? "Editar persona" : "Nueva persona"}
        onClose={() => setOpen(false)}
      >
        <form onSubmit={save} className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Datos personales
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Tipo de doc.">
                <select name="tipo_documento" className="control-input">
                  <option>DNI</option>
                  <option>CE</option>
                  <option>Pasaporte</option>
                </select>
              </Field>
              <Field label="Documento" className="sm:col-span-2">
                <input
                  name="documento"
                  defaultValue={editing?.documento ?? ""}
                  className="control-input"
                />
              </Field>
              <Field label="Nombres" className="sm:col-span-3">
                <input
                  name="nombres"
                  defaultValue={editing?.nombres ?? ""}
                  className="control-input"
                  required
                />
              </Field>
              <Field label="Apellidos" className="sm:col-span-3">
                <input
                  name="apellidos"
                  defaultValue={editing?.apellidos ?? ""}
                  className="control-input"
                  required
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">Contacto</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Celular personal">
                <input
                  name="telefono"
                  defaultValue={editing?.telefono ?? ""}
                  className="control-input"
                />
              </Field>
              <Field label="Celular corporativo">
                <input name="celular_corporativo" className="control-input" />
              </Field>
              <Field label="Correo corporativo" className="sm:col-span-2">
                <input
                  name="email"
                  type="email"
                  defaultValue={editing?.email ?? ""}
                  className="control-input"
                />
              </Field>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-800">
              Puesto y permisos
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Puesto">
                <select
                  name="puesto_id"
                  defaultValue={editing?.puesto_id ?? ""}
                  className="control-input"
                  required
                >
                  <option value="" disabled>
                    Selecciona un puesto
                  </option>
                  {puestos.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nombre}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Estado laboral">
                <select
                  name="estado_laboral"
                  defaultValue={editing?.estado_laboral ?? "activo"}
                  className="control-input"
                >
                  <option value="activo">Activo</option>
                  <option value="vacaciones">Vacaciones</option>
                </select>
              </Field>
              <Field label="Rol autorizado">
                <select name="role" defaultValue="" className="control-input">
                  <option value="">Promotor / sin acceso</option>
                  <option value="zonal">Zonal</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Switch
                name="puede_vender"
                label="Puede vender"
                hint="Aparece como vendedor en el punto de venta."
                defaultChecked={editing?.puede_vender}
              />
              <Switch
                name="is_active"
                label="Activo"
                hint="Desactívalo para ocultarlo sin eliminarlo."
                defaultChecked={editing?.is_active ?? true}
              />
            </div>
          </section>

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100"
            >
              Cancelar
            </button>
            <Button type="submit" disabled={pending}>
              {pending ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
