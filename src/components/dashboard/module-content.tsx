"use client";

import Link from "next/link";
import { type ReactNode, useActionState, useEffect, useState } from "react";
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
  user_id: string | null;
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
  if (activeModule === "personal") {
    return (
      <PersonalPanel
        activeView={activeView}
        users={users}
        promoters={promoters}
        stores={stores}
        permissions={permissions}
      />
    );
  }
  if (activeModule === "tiendas") {
    return <StoresPanel stores={stores} permissions={permissions} />;
  }

  return <ModulePlaceholder module={activeModule} />;
}

function PersonalPanel({
  activeView,
  users,
  promoters,
  stores,
  permissions,
}: {
  activeView?: string;
  users: UserRow[];
  promoters: PromoterRow[];
  stores: StoreRow[];
  permissions: string[];
}) {
  const canReadUsers = permissions.includes(PERMISSIONS.usersRead);
  const canCreateUser = permissions.includes(PERMISSIONS.usersCreate);
  const canReadPromoters = permissions.includes(PERMISSIONS.promotersRead);
  const canCreatePromoter = permissions.includes(PERMISSIONS.promotersCreate);

  const currentTab =
    activeView === "usuarios" && canReadUsers
      ? "usuarios"
      : canReadPromoters
        ? "promotores"
        : "usuarios";

  const [promoterModal, setPromoterModal] = useState(false);
  const [userModal, setUserModal] = useState(false);
  const [createLogin, setCreateLogin] = useState(false);
  const [promoterState, promoterAction, promoterPending] = useActionState(
    createPromoter,
    initialState,
  );
  const [userState, userAction, userPending] = useActionState(createAppUser, initialState);

  useEffect(() => {
    if (promoterState.ok) {
      setPromoterModal(false);
      setCreateLogin(false);
    }
  }, [promoterState]);

  useEffect(() => {
    if (userState.ok) setUserModal(false);
  }, [userState]);

  return (
    <div className="space-y-4">
      {promoterState.ok && promoterState.message && <ActionMessage state={promoterState} />}
      {userState.ok && userState.message && <ActionMessage state={userState} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Personal</h2>
            <p className="mt-1 text-xs text-slate-500">
              Promotores y usuarios internos se gestionan desde una sola vista.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {currentTab === "promotores" && canCreatePromoter && (
              <PrimaryButton onClick={() => setPromoterModal(true)}>Nuevo promotor</PrimaryButton>
            )}
            {currentTab === "usuarios" && canCreateUser && (
              <PrimaryButton onClick={() => setUserModal(true)}>Nuevo usuario interno</PrimaryButton>
            )}
          </div>
        </div>

        <div className="flex gap-1 border-b border-slate-100 px-5 pt-3">
          {canReadPromoters && (
            <TabLink
              active={currentTab === "promotores"}
              href="/dashboard?module=personal&view=promotores"
            >
              Promotores <Count>{promoters.length}</Count>
            </TabLink>
          )}
          {canReadUsers && (
            <TabLink
              active={currentTab === "usuarios"}
              href="/dashboard?module=personal&view=usuarios"
            >
              Usuarios internos <Count>{users.length}</Count>
            </TabLink>
          )}
        </div>

        {currentTab === "promotores" ? (
          <PromotersTable promoters={promoters} />
        ) : (
          <UsersTable users={users} />
        )}
      </section>

      <Modal
        open={promoterModal}
        title="Nuevo promotor"
        description="Registra al promotor y, si corresponde, crea su acceso al sistema en la misma operación."
        onClose={() => {
          if (!promoterPending) {
            setPromoterModal(false);
            setCreateLogin(false);
          }
        }}
      >
        <form action={promoterAction} className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Tienda</span>
            <select
              name="store_id"
              required
              defaultValue=""
              className="control-input"
              disabled={stores.length === 0}
            >
              <option value="" disabled>Selecciona una tienda</option>
              {stores.map((store) => (
                <option key={store.id} value={store.id}>{store.code} · {store.name}</option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombres" name="first_name" placeholder="Nombres" required />
            <Field label="Apellidos" name="last_name" placeholder="Apellidos" required />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Documento" name="document" placeholder="DNI / documento" />
            <Field label="Teléfono" name="phone" placeholder="Teléfono" />
          </div>

          <Field
            label={createLogin ? "Correo de acceso" : "Correo"}
            name="email"
            type="email"
            placeholder="promotor@empresa.com"
            required={createLogin}
          />

          <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <input
              type="checkbox"
              name="create_login"
              value="true"
              checked={createLogin}
              onChange={(event) => setCreateLogin(event.target.checked)}
              className="mt-0.5 size-4 rounded border-slate-300"
            />
            <span>
              <span className="block text-sm font-medium text-slate-800">Crear usuario de acceso</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                Se creará una cuenta Auth vinculada a este promotor con rol Promotor.
              </span>
            </span>
          </label>

          {createLogin && (
            <Field
              label="Contraseña inicial"
              name="initial_password"
              type="password"
              placeholder="Mínimo 8 caracteres"
              required
            />
          )}

          <ActionMessage state={promoterState} />
          <ModalActions
            pending={promoterPending}
            submitLabel={createLogin ? "Crear promotor y acceso" : "Crear promotor"}
            disabled={stores.length === 0}
            onCancel={() => {
              setPromoterModal(false);
              setCreateLogin(false);
            }}
          />
        </form>
      </Modal>

      <Modal
        open={userModal}
        title="Nuevo usuario interno"
        description="Crea una cuenta administrativa o de supervisión. Los promotores se crean desde la pestaña Promotores."
        onClose={() => !userPending && setUserModal(false)}
      >
        <form action={userAction} className="space-y-4">
          <Field label="Nombre completo" name="full_name" placeholder="Nombre y apellidos" required />
          <Field label="Correo" name="email" type="email" placeholder="usuario@empresa.com" required />
          <Field
            label="Contraseña inicial"
            name="initial_password"
            type="password"
            placeholder="Mínimo 8 caracteres"
            required
          />

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
                <option key={store.id} value={store.id}>{store.code} · {store.name}</option>
              ))}
            </select>
          </label>

          <ActionMessage state={userState} />
          <ModalActions
            pending={userPending}
            submitLabel="Crear usuario"
            onCancel={() => setUserModal(false)}
          />
        </form>
      </Modal>
    </div>
  );
}

function StoresPanel({ stores, permissions }: { stores: StoreRow[]; permissions: string[] }) {
  const canCreate = permissions.includes(PERMISSIONS.storesCreate);
  const [modalOpen, setModalOpen] = useState(false);
  const [state, action, pending] = useActionState(createStore, initialState);

  useEffect(() => {
    if (state.ok) setModalOpen(false);
  }, [state]);

  return (
    <div className="space-y-4">
      {state.ok && state.message && <ActionMessage state={state} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Tiendas</h2>
            <p className="mt-1 text-xs text-slate-500">{stores.length} visibles para tu cuenta.</p>
          </div>
          {canCreate && <PrimaryButton onClick={() => setModalOpen(true)}>Nueva tienda</PrimaryButton>}
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
              {stores.length === 0 && <EmptyRow colSpan={4} text="No hay tiendas disponibles para este usuario." />}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={modalOpen}
        title="Nueva tienda"
        description="Registra una unidad operativa para asignaciones, ventas e inventario."
        onClose={() => !pending && setModalOpen(false)}
      >
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código" name="code" placeholder="TDA-001" required />
            <Field label="Nombre" name="name" placeholder="Tienda Centro" required />
          </div>
          <Field label="Ciudad" name="city" placeholder="Ciudad" />
          <Field label="Dirección" name="address" placeholder="Dirección comercial" />
          <ActionMessage state={state} />
          <ModalActions pending={pending} submitLabel="Crear tienda" onCancel={() => setModalOpen(false)} />
        </form>
      </Modal>
    </div>
  );
}

function PromotersTable({ promoters }: { promoters: PromoterRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-5 py-3 font-medium">Promotor</th>
            <th className="px-5 py-3 font-medium">Tienda</th>
            <th className="px-5 py-3 font-medium">Documento</th>
            <th className="px-5 py-3 font-medium">Contacto</th>
            <th className="px-5 py-3 font-medium">Acceso</th>
            <th className="px-5 py-3 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {promoters.map((promoter) => (
            <tr key={promoter.id} className="hover:bg-slate-50/60">
              <td className="px-5 py-4 font-medium text-slate-900">{promoter.first_name} {promoter.last_name}</td>
              <td className="px-5 py-4 text-slate-600">
                {promoter.stores ? `${promoter.stores.code} · ${promoter.stores.name}` : "Sin tienda"}
              </td>
              <td className="px-5 py-4 text-slate-600">{promoter.document || "—"}</td>
              <td className="px-5 py-4">
                <p className="text-slate-600">{promoter.phone || "—"}</p>
                <p className="text-xs text-slate-400">{promoter.email || ""}</p>
              </td>
              <td className="px-5 py-4"><AccessStatus linked={Boolean(promoter.user_id)} /></td>
              <td className="px-5 py-4"><Status active={promoter.is_active} /></td>
            </tr>
          ))}
          {promoters.length === 0 && <EmptyRow colSpan={6} text="No hay promotores disponibles para las tiendas asignadas." />}
        </tbody>
      </table>
    </div>
  );
}

function UsersTable({ users }: { users: UserRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
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
          {users.length === 0 && <EmptyRow colSpan={4} text="No hay usuarios internos disponibles." />}
        </tbody>
      </table>
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
          <div className="mt-8 grid h-52 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center text-sm text-slate-400">Esperando información de ventas.</div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <h3 className="text-sm font-semibold text-slate-950">Actividad reciente</h3>
          <p className="mt-1 text-xs text-slate-500">Últimos eventos relevantes del sistema.</p>
        </article>
      </section>
    </>
  );
}

function ModulePlaceholder({ module }: { module: string }) {
  const titles: Record<string, string> = {
    inventario: "Inventario",
    ventas: "Ventas",
    horarios: "Horarios",
    cuotas: "Cuotas",
    analisis: "Análisis",
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/30">
      <div className="grid min-h-[360px] place-items-center text-center">
        <div className="max-w-md">
          <h2 className="text-xl font-semibold text-slate-950">{titles[module] ?? "Módulo"}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">La autorización y navegación ya están preparadas. La funcionalidad específica se implementará sobre esta base.</p>
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
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Cerrar modal" />
      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            {description && <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>}
          </div>
          <button type="button" onClick={onClose} className="grid size-8 shrink-0 place-items-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar">×</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ModalActions({
  pending,
  submitLabel,
  onCancel,
  disabled = false,
}: {
  pending: boolean;
  submitLabel: string;
  onCancel: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
      <button type="submit" disabled={pending || disabled} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">{pending ? "Guardando..." : submitLabel}</button>
    </div>
  );
}

function PrimaryButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <button type="button" onClick={onClick} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">{children}</button>;
}

function TabLink({ active, href, children }: { active: boolean; href: string; children: ReactNode }) {
  return <Link href={href} className={`border-b-2 px-3 py-3 text-sm font-medium transition-colors ${active ? "border-slate-950 text-slate-950" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{children}</Link>;
}

function Count({ children }: { children: ReactNode }) {
  return <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{children}</span>;
}

function Field({
  label,
  name,
  placeholder,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} placeholder={placeholder} required={required} className="control-input" />
    </label>
  );
}

function ActionMessage({ state }: { state: ManagementActionState }) {
  if (!state.message) return null;
  return <div className={`rounded-xl border px-3 py-2.5 text-xs ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</div>;
}

function Status({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />{active ? "Activo" : "Inactivo"}</span>;
}

function AccessStatus({ linked }: { linked: boolean }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${linked ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500"}`}>{linked ? "Con usuario" : "Sin acceso"}</span>;
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <tr><td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-400">{text}</td></tr>;
}

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
  } catch {
    return "—";
  }
}
