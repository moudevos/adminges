"use client";

import { type ReactNode, useActionState, useEffect, useState } from "react";
import {
  createStore,
  type ManagementActionState,
} from "@/app/dashboard/management-actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

type StoreRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
};

type ModuleContentProps = {
  activeModule: string;
  activeView?: string;
  permissions: string[];
  stores: StoreRow[];
};

const initialState: ManagementActionState = { ok: false, message: "" };

export function ModuleContent({
  activeModule,
  activeView,
  permissions,
  stores,
}: ModuleContentProps) {
  if (activeModule === "resumen") return <DashboardOverview />;
  if (activeModule === "tiendas") return <StoresPanel stores={stores} permissions={permissions} />;
  return <ModulePlaceholder module={activeModule} view={activeView} />;
}

function StoresPanel({ stores, permissions }: { stores: StoreRow[]; permissions: string[] }) {
  const canCreate = permissions.includes(PERMISSIONS.storesCreate);
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(createStore, initialState);

  useEffect(() => {
    if (state.ok) setOpen(false);
  }, [state]);

  return (
    <div className="space-y-4">
      {state.ok && state.message && <ActionMessage state={state} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Tiendas</h2>
            <p className="mt-1 text-xs text-slate-500">{stores.length} visibles</p>
          </div>
          {canCreate && <PrimaryButton onClick={() => setOpen(true)}>Nueva tienda</PrimaryButton>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Código</th>
                <th className="px-5 py-3 font-medium">Tienda</th>
                <th className="px-5 py-3 font-medium">Ubicación</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {stores.map((store) => (
                <tr key={store.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-500">{store.code}</td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{store.name}</p>
                    <p className="mt-0.5 max-w-72 truncate text-xs text-slate-400">{store.address || "Sin dirección"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{store.city || "—"}</td>
                  <td className="px-5 py-4"><Status active={store.is_active} /></td>
                </tr>
              ))}
              {stores.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-sm text-slate-400">
                    No hay tiendas disponibles para este usuario.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        title="Nueva tienda"
        description="Registra una unidad operativa para personal, ventas e inventario."
        onClose={() => { if (!pending) setOpen(false); }}
      >
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código" name="code" placeholder="TDA-001" required />
            <Field label="Nombre" name="name" placeholder="Tienda Centro" required />
          </div>
          <Field label="Ciudad" name="city" placeholder="Ciudad" />
          <Field label="Dirección" name="address" placeholder="Dirección comercial" />
          {!state.ok && state.message && <ActionMessage state={state} />}
          <ModalActions onCancel={() => setOpen(false)} pending={pending} label="Crear tienda" />
        </form>
      </Modal>
    </div>
  );
}

function DashboardOverview() {
  const kpis = [
    ["Ventas del día", "S/ 0.00", "Sin datos registrados"],
    ["Cumplimiento diario", "0%", "Cuota pendiente"],
    ["Tiendas activas", "0", "Se actualizará con datos reales"],
    ["Alertas de inventario", "0", "Sin alertas detectadas"],
  ];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, note]) => (
          <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
            <p className="mt-2 text-xs text-slate-400">{note}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <article className="min-h-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <h3 className="text-sm font-semibold text-slate-950">Evolución comercial</h3>
          <p className="mt-1 text-xs text-slate-500">Ventas y cumplimiento de cuota.</p>
          <div className="mt-8 grid h-52 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center text-sm text-slate-400">
            Esperando información de ventas.
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <h3 className="text-sm font-semibold text-slate-950">Actividad reciente</h3>
          <p className="mt-1 text-xs text-slate-500">Últimos eventos relevantes del sistema.</p>
          <div className="mt-6 text-sm text-slate-400">Aún no hay actividad registrada.</div>
        </article>
      </section>
    </>
  );
}

function ModulePlaceholder({ module, view }: { module: string; view?: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/30">
      <div className="grid min-h-[360px] place-items-center text-center">
        <div className="max-w-md">
          <h2 className="text-xl font-semibold capitalize text-slate-950">{view ?? module}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            La autorización del módulo ya está activa. La funcionalidad específica se implementará sobre esta base.
          </p>
        </div>
      </div>
    </section>
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
  description: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm" onClick={onClose} aria-label="Cerrar modal" />
      <section className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-lg text-slate-400 hover:bg-slate-100" aria-label="Cerrar">×</button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} placeholder={placeholder} required={required} className="control-input" />
    </label>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
      {children}
    </button>
  );
}

function ModalActions({ onCancel, pending, label }: { onCancel: () => void; pending: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
      <button disabled={pending} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{pending ? "Guardando..." : label}</button>
    </div>
  );
}

function ActionMessage({ state }: { state: ManagementActionState }) {
  if (!state.message) return null;
  return (
    <div className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
      {state.message}
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${active ? "text-emerald-600" : "text-slate-400"}`}>
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-300"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}