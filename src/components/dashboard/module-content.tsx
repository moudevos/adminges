"use client";

import { useActionState } from "react";
import {
  createAppUser,
  createPromoter,
  createStore,
  type ManagementActionState,
} from "@/app/dashboard/management-actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "supervisor";
  is_active: boolean;
  created_at: string;
};

type StoreRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
};

type PromoterRow = {
  id: string;
  store_id: string | null;
  first_name: string;
  last_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  stores: { name: string; code: string } | null;
};

type ModuleContentProps = {
  activeModule: string;
  activeView?: string;
  permissions: string[];
  users: UserRow[];
  stores: StoreRow[];
  promoters: PromoterRow[];
};

const initialState: ManagementActionState = { ok: false, message: "" };

export function ModuleContent({
  activeModule,
  activeView,
  permissions,
  users,
  stores,
  promoters,
}: ModuleContentProps) {
  if (activeModule === "resumen") return <DashboardOverview />;
  if (activeModule === "usuarios") {
    return <UsersPanel users={users} stores={stores} permissions={permissions} />;
  }
  if (activeModule === "tiendas") {
    return <StoresPanel stores={stores} permissions={permissions} />;
  }
  if (activeModule === "promotores") {
    return <PromotersPanel promoters={promoters} stores={stores} permissions={permissions} />;
  }

  return <ModulePlaceholder module={activeModule} view={activeView} />;
}

function UsersPanel({ users, stores, permissions }: { users: UserRow[]; stores: StoreRow[]; permissions: string[] }) {
  const canCreate = permissions.includes(PERMISSIONS.usersCreate);
  const [state, action, pending] = useActionState(createAppUser, initialState);

  return (
    <div className={`grid gap-5 ${canCreate ? "xl:grid-cols-[390px_1fr]" : ""}`}>
      {canCreate && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-950">Nuevo usuario</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">Crea acceso al sistema y asigna el rol inicial.</p>
          </div>

          <form action={action} className="space-y-4">
            <Field label="Nombre completo" name="full_name" placeholder="Nombre y apellidos" required />
            <Field label="Correo" name="email" type="email" placeholder="usuario@empresa.com" required />
            <Field label="Contraseña inicial" name="initial_password" type="password" placeholder="Mínimo 8 caracteres" required />

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Rol</span>
              <select name="role" defaultValue="supervisor" className="control-input">
                <option value="supervisor">Supervisor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Tienda inicial</span>
              <select name="store_id" defaultValue="" className="control-input">
                <option value="">Sin asignar</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>
                    {store.code} · {store.name}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] text-slate-400">Se usa para supervisores; luego podremos manejar múltiples asignaciones.</span>
            </label>

            <ActionMessage state={state} />
            <SubmitButton pending={pending} label="Crear usuario" />
          </form>
        </section>
      )}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <PanelHeader title="Usuarios" meta={`${users.length} registrados`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 font-medium">Alta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{user.full_name || "Sin nombre"}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{user.email || "Sin correo"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{user.role === "admin" ? "Administrador" : "Supervisor"}</td>
                  <td className="px-5 py-4"><Status active={user.is_active} /></td>
                  <td className="px-5 py-4 text-xs text-slate-500">{formatDate(user.created_at)}</td>
                </tr>
              ))}
              {users.length === 0 && <EmptyRow colSpan={4} text="No hay usuarios disponibles." />}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function StoresPanel({ stores, permissions }: { stores: StoreRow[]; permissions: string[] }) {
  const canCreate = permissions.includes(PERMISSIONS.storesCreate);
  const [state, action, pending] = useActionState(createStore, initialState);

  return (
    <div className={`grid gap-5 ${canCreate ? "xl:grid-cols-[390px_1fr]" : ""}`}>
      {canCreate && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-950">Nueva tienda</h2>
            <p className="mt-1 text-xs text-slate-500">Registra una unidad operativa para asignaciones, ventas e inventario.</p>
          </div>
          <form action={action} className="space-y-4">
            <Field label="Código" name="code" placeholder="TDA-001" required />
            <Field label="Nombre" name="name" placeholder="Tienda Centro" required />
            <Field label="Ciudad" name="city" placeholder="Ciudad" />
            <Field label="Dirección" name="address" placeholder="Dirección comercial" />
            <ActionMessage state={state} />
            <SubmitButton pending={pending} label="Crear tienda" />
          </form>
        </section>
      )}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <PanelHeader title="Tiendas" meta={`${stores.length} visibles`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
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
              {stores.length === 0 && <EmptyRow colSpan={4} text="No hay tiendas disponibles para este usuario." />}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PromotersPanel({ promoters, stores, permissions }: { promoters: PromoterRow[]; stores: StoreRow[]; permissions: string[] }) {
  const canCreate = permissions.includes(PERMISSIONS.promotersCreate);
  const [state, action, pending] = useActionState(createPromoter, initialState);

  return (
    <div className={`grid gap-5 ${canCreate ? "xl:grid-cols-[390px_1fr]" : ""}`}>
      {canCreate && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-950">Nuevo promotor</h2>
            <p className="mt-1 text-xs text-slate-500">El promotor queda vinculado a una tienda visible para tu cuenta.</p>
          </div>
          <form action={action} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Tienda</span>
              <select name="store_id" required defaultValue="" className="control-input" disabled={stores.length === 0}>
                <option value="" disabled>Selecciona una tienda</option>
                {stores.map((store) => (
                  <option key={store.id} value={store.id}>{store.code} · {store.name}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombres" name="first_name" placeholder="Nombres" required />
              <Field label="Apellidos" name="last_name" placeholder="Apellidos" required />
            </div>
            <Field label="Documento" name="document" placeholder="DNI / documento" />
            <Field label="Teléfono" name="phone" placeholder="Teléfono" />
            <Field label="Correo" name="email" type="email" placeholder="promotor@empresa.com" />
            <ActionMessage state={state} />
            <SubmitButton pending={pending} label="Crear promotor" disabled={stores.length === 0} />
          </form>
        </section>
      )}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <PanelHeader title="Promotores" meta={`${promoters.length} visibles`} />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="border-y border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Promotor</th>
                <th className="px-5 py-3 font-medium">Tienda</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Contacto</th>
                <th className="px-5 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {promoters.map((promoter) => (
                <tr key={promoter.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4 font-medium text-slate-900">{promoter.first_name} {promoter.last_name}</td>
                  <td className="px-5 py-4 text-slate-600">{promoter.stores ? `${promoter.stores.code} · ${promoter.stores.name}` : "Sin tienda"}</td>
                  <td className="px-5 py-4 text-slate-600">{promoter.document || "—"}</td>
                  <td className="px-5 py-4">
                    <p className="text-slate-600">{promoter.phone || "—"}</p>
                    <p className="text-xs text-slate-400">{promoter.email || ""}</p>
                  </td>
                  <td className="px-5 py-4"><Status active={promoter.is_active} /></td>
                </tr>
              ))}
              {promoters.length === 0 && <EmptyRow colSpan={5} text="No hay promotores disponibles para las tiendas asignadas." />}
            </tbody>
          </table>
        </div>
      </section>
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
          <div className="mt-6 space-y-4 text-sm text-slate-400">Aún no hay actividad registrada.</div>
        </article>
      </section>
    </>
  );
}

function ModulePlaceholder({ module, view }: { module: string; view?: string }) {
  return (
    <section className="grid min-h-[440px] place-items-center rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm shadow-slate-200/30">
      <div className="max-w-md">
        <p className="text-sm font-semibold capitalize text-slate-900">{view || module}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">El acceso ya está protegido por permisos. La funcionalidad operativa de este módulo se implementará en su siguiente bloque.</p>
      </div>
    </section>
  );
}

function Field({ label, name, type = "text", placeholder, required = false }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} required={required} placeholder={placeholder} className="control-input" />
    </label>
  );
}

function SubmitButton({ pending, label, disabled = false }: { pending: boolean; label: string; disabled?: boolean }) {
  return (
    <button type="submit" disabled={pending || disabled} className="w-full rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
      {pending ? "Guardando..." : label}
    </button>
  );
}

function ActionMessage({ state }: { state: ManagementActionState }) {
  if (!state.message) return null;
  return <p className={`rounded-xl px-3 py-2.5 text-xs ${state.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>{state.message}</p>;
}

function PanelHeader({ title, meta }: { title: string; meta: string }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4">
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">{meta}</span>
    </div>
  );
}

function Status({ active }: { active: boolean }) {
  return <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{active ? "Activo" : "Inactivo"}</span>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-400">{text}</td></tr>;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return "—";
  }
}
