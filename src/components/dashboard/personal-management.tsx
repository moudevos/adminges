"use client";

import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";
import {
  createPersonUnified,
  updatePersonUnified,
  type PersonActionState,
} from "@/app/dashboard/person-actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

type Role = "admin" | "supervisor" | "promotor";

type UserRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  document: string | null;
  phone: string | null;
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
  document: string;
  phone: string;
  email: string;
  role: Role;
  storeId: string;
  storeLabel: string;
  isActive: boolean;
};

type Props = {
  users: UserRow[];
  promoters: PromoterRow[];
  stores: StoreRow[];
  permissions: string[];
};

const initialState: PersonActionState = { ok: false, message: "" };

export function PersonalManagement({ users, promoters, stores, permissions }: Props) {
  const canCreateInternal = permissions.includes(PERMISSIONS.usersCreate);
  const canCreatePromoter = permissions.includes(PERMISSIONS.promotersCreate);
  const canUpdateInternal = permissions.includes(PERMISSIONS.usersUpdate);
  const canUpdatePromoter = permissions.includes(PERMISSIONS.promotersUpdate);

  const people = useMemo<PersonRow[]>(() => {
    const internal = users.map<PersonRow>((user) => {
      const { firstName, lastName } = splitFullName(user.full_name ?? "");
      const assignment = user.store_supervisors?.find((item) => item.is_active);
      return {
        key: `user-${user.id}`,
        userId: user.id,
        promoterId: null,
        firstName,
        lastName,
        document: user.document ?? "",
        phone: user.phone ?? "",
        email: user.email ?? "",
        role: user.role,
        storeId: assignment?.store_id ?? "",
        storeLabel: assignment?.stores
          ? `${assignment.stores.code} · ${assignment.stores.name}`
          : "Sin tienda",
        isActive: user.is_active,
      };
    });

    const commercial = promoters.map<PersonRow>((promoter) => ({
      key: `promoter-${promoter.id}`,
      userId: promoter.user_id,
      promoterId: promoter.id,
      firstName: promoter.first_name,
      lastName: promoter.last_name,
      document: promoter.document ?? "",
      phone: promoter.phone ?? "",
      email: promoter.email ?? "",
      role: "promotor",
      storeId: promoter.store_id ?? "",
      storeLabel: promoter.stores
        ? `${promoter.stores.code} · ${promoter.stores.name}`
        : "Sin tienda",
      isActive: promoter.is_active,
    }));

    return [...internal, ...commercial].sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`, "es"),
    );
  }, [users, promoters]);

  const createRoles = roleOptions(canCreateInternal, canCreatePromoter);
  const editRoles = roleOptions(canUpdateInternal, canUpdatePromoter);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PersonRow | null>(null);
  const [createRole, setCreateRole] = useState<Role>(createRoles[0]?.value ?? "promotor");
  const [editRole, setEditRole] = useState<Role>("promotor");
  const [createState, createAction, createPending] = useActionState(
    createPersonUnified,
    initialState,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updatePersonUnified,
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

  function openCreate() {
    setCreateRole(createRoles[0]?.value ?? "promotor");
    setCreateOpen(true);
  }

  function canEdit(person: PersonRow) {
    return person.role === "promotor" ? canUpdatePromoter : canUpdateInternal;
  }

  return (
    <div className="space-y-4">
      {createState.message && <ActionMessage state={createState} />}
      {updateState.message && <ActionMessage state={updateState} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Personal</h2>
            <p className="mt-1 text-xs text-slate-500">
              Documento y teléfono pertenecen a la persona y se gestionan igual para todos los roles.
            </p>
          </div>
          {createRoles.length > 0 && <PrimaryButton onClick={openCreate}>Nueva persona</PrimaryButton>}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Teléfono</th>
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
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {person.firstName} {person.lastName}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{person.document || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{person.phone || "—"}</td>
                  <td className="px-5 py-4">
                    <p className="text-slate-600">{person.email || "Sin usuario"}</p>
                    {!person.userId && (
                      <p className="mt-0.5 text-[11px] font-medium text-amber-600">Acceso pendiente</p>
                    )}
                  </td>
                  <td className="px-5 py-4"><RoleBadge role={person.role} /></td>
                  <td className="px-5 py-4 text-slate-600">{person.storeLabel}</td>
                  <td className="px-5 py-4"><Status active={person.isActive} /></td>
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
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">No hay personas disponibles.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Nueva persona"
        description="Registra datos personales, rol, tienda y credenciales en una sola operación."
        onClose={() => { if (!createPending) setCreateOpen(false); }}
      >
        <form action={createAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nombres" name="first_name" required />
            <Field label="Apellidos" name="last_name" required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Documento" name="document" placeholder="DNI / documento" />
            <Field label="Teléfono" name="phone" placeholder="Celular / teléfono" />
          </div>
          <RoleSelect value={createRole} roles={createRoles} onChange={setCreateRole} />
          {(createRole === "supervisor" || createRole === "promotor") && (
            <StoreSelect stores={stores} />
          )}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acceso al sistema</p>
            <div className="mt-3 space-y-3">
              <Field label="Usuario / correo" name="email" type="email" required />
              <Field label="Contraseña inicial" name="initial_password" type="password" required />
            </div>
          </div>
          <ActionMessage state={createState} />
          <ModalActions onCancel={() => setCreateOpen(false)} pending={createPending} label="Crear persona" />
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Editar persona"
        description="Los datos personales son comunes a todos los roles. También puedes cambiar rol, tienda, estado y contraseña."
        onClose={() => { if (!updatePending) setEditing(null); }}
      >
        {editing && (
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="user_id" value={editing.userId ?? ""} />
            <input type="hidden" name="promoter_id" value={editing.promoterId ?? ""} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nombres" name="first_name" defaultValue={editing.firstName} required />
              <Field label="Apellidos" name="last_name" defaultValue={editing.lastName} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Documento" name="document" defaultValue={editing.document} placeholder="DNI / documento" />
              <Field label="Teléfono" name="phone" defaultValue={editing.phone} placeholder="Celular / teléfono" />
            </div>
            <RoleSelect
              value={editRole}
              roles={ensureCurrentRole(editRoles, editing.role)}
              onChange={setEditRole}
            />
            {(editRole === "supervisor" || editRole === "promotor") && (
              <StoreSelect stores={stores} defaultValue={editing.storeId} />
            )}
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Estado</span>
              <select name="is_active" defaultValue={editing.isActive ? "true" : "false"} className="control-input">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Usuario y contraseña</p>
              <div className="mt-3 space-y-3">
                <Field label="Usuario / correo" name="email" type="email" defaultValue={editing.email} required />
                <Field
                  label={editing.userId ? "Nueva contraseña" : "Contraseña para crear acceso"}
                  name="new_password"
                  type="password"
                  placeholder={editing.userId ? "Vacío = conservar actual" : "Mínimo 8 caracteres"}
                  required={!editing.userId}
                />
                <p className="text-[11px] leading-5 text-slate-400">
                  La contraseña actual nunca se puede consultar; solo se puede reemplazar.
                </p>
              </div>
            </div>
            <ActionMessage state={updateState} />
            <ModalActions onCancel={() => setEditing(null)} pending={updatePending} label="Guardar cambios" />
          </form>
        )}
      </Modal>
    </div>
  );
}

function RoleSelect({ value, roles, onChange }: { value: Role; roles: Array<{ value: Role; label: string }>; onChange: (role: Role) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">Rol</span>
      <select value={value} name="role" onChange={(event) => onChange(event.target.value as Role)} className="control-input">
        {roles.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
      </select>
    </label>
  );
}

function StoreSelect({ stores, defaultValue = "" }: { stores: StoreRow[]; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">Tienda asignada</span>
      <select name="store_id" required defaultValue={defaultValue} className="control-input" disabled={stores.length === 0}>
        <option value="" disabled>Selecciona una tienda</option>
        {stores.map((store) => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}
      </select>
    </label>
  );
}

function Field({ label, name, type = "text", placeholder, required = false, defaultValue }: { label: string; name: string; type?: string; placeholder?: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">{label}</span>
      <input name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue} className="control-input" />
    </label>
  );
}

function Modal({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keyHandler = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", keyHandler);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", keyHandler);
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

function ModalActions({ onCancel, pending, label }: { onCancel: () => void; pending: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
      <button type="submit" disabled={pending} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{pending ? "Guardando..." : label}</button>
    </div>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">{children}</button>;
}

function ActionMessage({ state }: { state: PersonActionState }) {
  if (!state.message) return null;
  return <div className={`rounded-xl border px-3 py-2.5 text-xs ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</div>;
}

function RoleBadge({ role }: { role: Role }) {
  const label = role === "admin" ? "Administrador" : role === "supervisor" ? "Supervisor" : "Promotor";
  return <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{label}</span>;
}

function Status({ active }: { active: boolean }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}><span className={`size-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-slate-400"}`} />{active ? "Activo" : "Inactivo"}</span>;
}

function roleOptions(canInternal: boolean, canPromoter: boolean) {
  const roles: Array<{ value: Role; label: string }> = [];
  if (canInternal) {
    roles.push({ value: "admin", label: "Administrador" });
    roles.push({ value: "supervisor", label: "Supervisor" });
  }
  if (canPromoter) roles.push({ value: "promotor", label: "Promotor" });
  return roles;
}

function ensureCurrentRole(options: Array<{ value: Role; label: string }>, current: Role) {
  if (options.some((option) => option.value === current)) return options;
  const label = current === "admin" ? "Administrador" : current === "supervisor" ? "Supervisor" : "Promotor";
  return [{ value: current, label }, ...options];
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] ?? "", lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}