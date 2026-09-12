"use client";

import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";
import {
  createPerson,
  createStore,
  updatePerson,
  type ManagementActionState,
} from "@/app/dashboard/management-actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

type Role = "admin" | "supervisor" | "promotor";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: "admin" | "supervisor";
  is_active: boolean;
  created_at: string;
  store_supervisors?: Array<{
    store_id: string;
    is_active: boolean;
    stores: { name: string; code: string } | null;
  }>;
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

type PersonRow = {
  key: string;
  userId: string | null;
  promoterId: string | null;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  storeId: string;
  storeLabel: string;
  document: string;
  phone: string;
  isActive: boolean;
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
  permissions,
  users,
  stores,
  promoters,
}: ModuleContentProps) {
  if (activeModule === "resumen") return <DashboardOverview />;

  if (activeModule === "personal") {
    return (
      <PersonalPanel
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
  users,
  promoters,
  stores,
  permissions,
}: {
  users: UserRow[];
  promoters: PromoterRow[];
  stores: StoreRow[];
  permissions: string[];
}) {
  const canCreateInternal = permissions.includes(PERMISSIONS.usersCreate);
  const canCreatePromoter = permissions.includes(PERMISSIONS.promotersCreate);
  const canUpdateInternal = permissions.includes(PERMISSIONS.usersUpdate);
  const canUpdatePromoter = permissions.includes(PERMISSIONS.promotersUpdate);
  const canCreateAny = canCreateInternal || canCreatePromoter;

  const people = useMemo<PersonRow[]>(() => {
    const internal: PersonRow[] = users.map((user) => {
      const { firstName, lastName } = splitFullName(user.full_name ?? "");
      const assignment = user.store_supervisors?.find((item) => item.is_active);

      return {
        key: `user-${user.id}`,
        userId: user.id,
        promoterId: null,
        firstName,
        lastName,
        email: user.email ?? "",
        role: user.role,
        storeId: assignment?.store_id ?? "",
        storeLabel: assignment?.stores
          ? `${assignment.stores.code} · ${assignment.stores.name}`
          : "Sin tienda",
        document: "",
        phone: "",
        isActive: user.is_active,
      };
    });

    const commercial: PersonRow[] = promoters.map((promoter) => ({
      key: `promoter-${promoter.id}`,
      userId: promoter.user_id,
      promoterId: promoter.id,
      firstName: promoter.first_name,
      lastName: promoter.last_name,
      email: promoter.email ?? "",
      role: "promotor",
      storeId: promoter.store_id ?? "",
      storeLabel: promoter.stores
        ? `${promoter.stores.code} · ${promoter.stores.name}`
        : "Sin tienda",
      document: promoter.document ?? "",
      phone: promoter.phone ?? "",
      isActive: promoter.is_active,
    }));

    return [...internal, ...commercial].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "es"),
    );
  }, [users, promoters]);

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [createRole, setCreateRole] = useState<Role>(
    canCreatePromoter ? "promotor" : "supervisor",
  );
  const [editRole, setEditRole] = useState<Role>("promotor");

  const [createState, createAction, createPending] = useActionState(
    createPerson,
    initialState,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updatePerson,
    initialState,
  );

  useEffect(() => {
    if (createState.ok) setCreateOpen(false);
  }, [createState]);

  useEffect(() => {
    if (updateState.ok) setEditing(null);
  }, [updateState]);

  useEffect(() => {
    if (editing) setEditRole(editing.role);
  }, [editing]);

  const createRoles = roleOptions(canCreateInternal, canCreatePromoter);
  const editRoles = roleOptions(canUpdateInternal, canUpdatePromoter);

  function openCreate() {
    const firstRole = createRoles[0]?.value ?? "promotor";
    setCreateRole(firstRole);
    setCreateOpen(true);
  }

  function canEdit(person: PersonRow) {
    return person.role === "promotor" ? canUpdatePromoter : canUpdateInternal;
  }

  return (
    <div className="space-y-4">
      {createState.ok && createState.message && <ActionMessage state={createState} />}
      {updateState.ok && updateState.message && <ActionMessage state={updateState} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Personal</h2>
            <p className="mt-1 text-xs text-slate-500">
              Una persona, una cuenta de acceso y un rol. El correo funciona como usuario de ingreso.
            </p>
          </div>

          {canCreateAny && (
            <PrimaryButton onClick={openCreate}>Nueva persona</PrimaryButton>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Tienda</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((person) => (
                <tr key={person.key} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {person.firstName} {person.lastName}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {person.document || person.phone || "Sin datos adicionales"}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="text-slate-600">{person.email || "Sin usuario"}</p>
                    {!person.userId && (
                      <p className="mt-0.5 text-[11px] font-medium text-amber-600">
                        Acceso pendiente
                      </p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <RoleBadge role={person.role} />
                  </td>
                  <td className="px-5 py-4 text-slate-600">{person.storeLabel}</td>
                  <td className="px-5 py-4">
                    <Status active={person.isActive} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    {canEdit(person) ? (
                      <button
                        type="button"
                        onClick={() => setEditing(person)}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                      >
                        Editar
                      </button>
                    ) : (
                      <span className="text-xs text-slate-300">Sin permiso</span>
                    )}
                  </td>
                </tr>
              ))}
              {people.length === 0 && (
                <EmptyRow colSpan={6} text="No hay personas disponibles para tu cuenta." />
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Nueva persona"
        description="Crea la persona, su usuario, contraseña inicial, rol y asignación operativa en una sola operación."
        onClose={() => {
          if (!createPending) setCreateOpen(false);
        }}
      >
        <form action={createAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombres" name="first_name" placeholder="Nombres" required />
            <Field label="Apellidos" name="last_name" placeholder="Apellidos" required />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Rol</span>
            <select
              name="role"
              value={createRole}
              onChange={(event) => setCreateRole(event.target.value as Role)}
              className="control-input"
            >
              {createRoles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>

          {(createRole === "supervisor" || createRole === "promotor") && (
            <StoreSelect stores={stores} />
          )}

          {createRole === "promotor" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Documento" name="document" placeholder="DNI / documento" />
              <Field label="Teléfono" name="phone" placeholder="Teléfono" />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Acceso al sistema
            </p>
            <div className="mt-3 space-y-3">
              <Field
                label="Usuario / correo"
                name="email"
                type="email"
                placeholder="persona@empresa.com"
                required
              />
              <Field
                label="Contraseña inicial"
                name="initial_password"
                type="password"
                placeholder="Mínimo 8 caracteres"
                required
              />
            </div>
          </div>

          <ActionMessage state={createState} />
          <ModalActions
            onCancel={() => setCreateOpen(false)}
            pending={createPending}
            submitLabel="Crear persona"
          />
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Editar persona"
        description="Actualiza el usuario, rol, tienda y estado. La contraseña actual nunca se muestra; solo puede reemplazarse."
        onClose={() => {
          if (!updatePending) setEditing(null);
        }}
      >
        {editing && (
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="user_id" value={editing.userId ?? ""} />
            <input type="hidden" name="promoter_id" value={editing.promoterId ?? ""} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Field
                label="Nombres"
                name="first_name"
                defaultValue={editing.firstName}
                required
              />
              <Field
                label="Apellidos"
                name="last_name"
                defaultValue={editing.lastName}
                required
              />
            </div>

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Rol</span>
              <select
                name="role"
                value={editRole}
                onChange={(event) => setEditRole(event.target.value as Role)}
                className="control-input"
              >
                {ensureCurrentRole(editRoles, editing.role).map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            </label>

            {(editRole === "supervisor" || editRole === "promotor") && (
              <StoreSelect stores={stores} defaultValue={editing.storeId} />
            )}

            {editRole === "promotor" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Documento"
                  name="document"
                  defaultValue={editing.document}
                  placeholder="DNI / documento"
                />
                <Field
                  label="Teléfono"
                  name="phone"
                  defaultValue={editing.phone}
                  placeholder="Teléfono"
                />
              </div>
            )}

            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Estado</span>
              <select
                name="is_active"
                defaultValue={editing.isActive ? "true" : "false"}
                className="control-input"
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Usuario y contraseña
              </p>
              <div className="mt-3 space-y-3">
                <Field
                  label="Usuario / correo"
                  name="email"
                  type="email"
                  defaultValue={editing.email}
                  placeholder="persona@empresa.com"
                  required
                />
                <Field
                  label={editing.userId ? "Nueva contraseña" : "Contraseña para crear acceso"}
                  name="new_password"
                  type="password"
                  placeholder={
                    editing.userId
                      ? "Dejar vacío para conservar la actual"
                      : "Mínimo 8 caracteres"
                  }
                  required={!editing.userId}
                />
                <p className="text-[11px] leading-5 text-slate-400">
                  Por seguridad Supabase no permite consultar la contraseña actual. Aquí solo
                  puedes establecer una nueva.
                </p>
              </div>
            </div>

            <ActionMessage state={updateState} />
            <ModalActions
              onCancel={() => setEditing(null)}
              pending={updatePending}
              submitLabel="Guardar cambios"
            />
          </form>
        )}
      </Modal>
    </div>
  );
}

function StoresPanel({
  stores,
  permissions,
}: {
  stores: StoreRow[];
  permissions: string[];
}) {
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
                  <td className="px-5 py-4 font-mono text-xs font-semibold text-slate-500">
                    {store.code}
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{store.name}</p>
                    <p className="mt-0.5 max-w-72 truncate text-xs text-slate-400">
                      {store.address || "Sin dirección"}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{store.city || "—"}</td>
                  <td className="px-5 py-4">
                    <Status active={store.is_active} />
                  </td>
                </tr>
              ))}
              {stores.length === 0 && (
                <EmptyRow colSpan={4} text="No hay tiendas disponibles para este usuario." />
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={open}
        title="Nueva tienda"
        description="Registra una unidad operativa para personal, ventas e inventario."
        onClose={() => {
          if (!pending) setOpen(false);
        }}
      >
        <form action={action} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Código" name="code" placeholder="TDA-001" required />
            <Field label="Nombre" name="name" placeholder="Tienda Centro" required />
          </div>
          <Field label="Ciudad" name="city" placeholder="Ciudad" />
          <Field label="Dirección" name="address" placeholder="Dirección comercial" />
          <ActionMessage state={state} />
          <ModalActions
            onCancel={() => setOpen(false)}
            pending={pending}
            submitLabel="Crear tienda"
          />
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
          <article
            key={label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30"
          >
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

function ModulePlaceholder({ module }: { module: string }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/30">
      <div className="grid min-h-[360px] place-items-center text-center">
        <div className="max-w-md">
          <h2 className="text-xl font-semibold capitalize text-slate-950">{module}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            La autorización del módulo ya está activa. La funcionalidad específica se
            implementará sobre esta base.
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

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Cerrar modal"
      />
      <section className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">{title}</h2>
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid size-8 shrink-0 place-items-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Cerrar"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}

function StoreSelect({
  stores,
  defaultValue = "",
}: {
  stores: StoreRow[];
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">Tienda asignada</span>
      <select
        name="store_id"
        required
        defaultValue={defaultValue}
        className="control-input"
        disabled={stores.length === 0}
      >
        <option value="" disabled>
          Selecciona una tienda
        </option>
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.code} · {store.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        defaultValue={defaultValue}
        className="control-input"
      />
    </label>
  );
}

function PrimaryButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800"
    >
      {children}
    </button>
  );
}

function ModalActions({
  onCancel,
  pending,
  submitLabel,
}: {
  onCancel: () => void;
  pending: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button
        type="button"
        onClick={onCancel}
        disabled={pending}
        className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Guardando..." : submitLabel}
      </button>
    </div>
  );
}

function ActionMessage({ state }: { state: ManagementActionState }) {
  if (!state.message) return null;
  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-xs ${
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700"
      }`}
    >
      {state.message}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const label =
    role === "admin" ? "Administrador" : role === "supervisor" ? "Supervisor" : "Promotor";
  return (
    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
      {label}
    </span>
  );
}

function Status({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />
      {active ? "Activo" : "Inactivo"}
    </span>
  );
}

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-5 py-12 text-center text-sm text-slate-400">
        {text}
      </td>
    </tr>
  );
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts.at(-1) ?? "",
  };
}

function roleOptions(canInternal: boolean, canPromoter: boolean) {
  const roles: Array<{ value: Role; label: string }> = [];

  if (canPromoter) {
    roles.push({ value: "promotor", label: "Promotor" });
  }

  if (canInternal) {
    roles.push(
      { value: "supervisor", label: "Supervisor" },
      { value: "admin", label: "Administrador" },
    );
  }

  return roles;
}

function ensureCurrentRole(
  options: Array<{ value: Role; label: string }>,
  current: Role,
) {
  if (options.some((option) => option.value === current)) return options;

  const label =
    current === "admin" ? "Administrador" : current === "supervisor" ? "Supervisor" : "Promotor";

  return [{ value: current, label }, ...options];
}
