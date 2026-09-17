"use client";

import { type ReactNode, useActionState, useEffect, useMemo, useState } from "react";
import {
  createPersonUnified,
  updatePersonUnified,
  type PersonActionState,
} from "@/app/dashboard/person-actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

type Role = "admin" | "zonal" | "supervisor" | "promotor";
type ScopeType = "global" | "zone" | "cluster" | "stores" | "store";

type PuestoRow = {
  id: string;
  code: string;
  name: string;
};

type ZoneRow = {
  id: string;
  code: string;
  name: string;
};

type ClusterRow = {
  id: string;
  zone_id: string;
  code: string;
  name: string;
};

type StoreRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  zone_id: string | null;
  cluster_id: string | null;
  is_active: boolean;
};

type PersonaRow = {
  id: string;
  user_id: string | null;
  puesto_id: string;
  first_name: string;
  last_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
  puestos: { code: string; name: string } | null;
  persona_zones?: Array<{
    zone_id: string;
    is_active: boolean;
    zones: { code: string; name: string } | null;
  }>;
  persona_clusters?: Array<{
    cluster_id: string;
    is_active: boolean;
    clusters: { code: string; name: string } | null;
  }>;
  persona_stores?: Array<{
    store_id: string;
    is_active: boolean;
    stores: { code: string; name: string } | null;
  }>;
};

type Props = {
  actorRole: Role;
  personas: PersonaRow[];
  stores: StoreRow[];
  puestos: PuestoRow[];
  zones: ZoneRow[];
  clusters: ClusterRow[];
  permissions: string[];
};

const initialState: PersonActionState = { ok: false, message: "" };

function rolesForActor(actorRole: Role) {
  if (actorRole === "admin") {
    return ["admin", "zonal", "supervisor", "promotor"] as Role[];
  }
  if (actorRole === "zonal") return ["supervisor", "promotor"] as Role[];
  if (actorRole === "supervisor") return ["promotor"] as Role[];
  return [] as Role[];
}

function defaultScope(role: Role): ScopeType {
  if (role === "admin") return "global";
  if (role === "zonal") return "zone";
  if (role === "supervisor") return "stores";
  return "store";
}

function roleLabel(role: Role) {
  if (role === "admin") return "Administrador";
  if (role === "zonal") return "Zonal";
  if (role === "supervisor") return "Supervisor";
  return "Promotor";
}

function standardPositionCode(role: Role) {
  if (role === "admin") return "administrador";
  return role;
}

function scopeForPersona(persona: PersonaRow): ScopeType {
  if (persona.role === "admin") return "global";
  if (persona.role === "zonal") return "zone";
  if (persona.role === "supervisor") {
    return persona.persona_clusters?.some((item) => item.is_active) ? "cluster" : "stores";
  }
  return "store";
}

function scopeLabel(persona: PersonaRow) {
  if (persona.role === "admin") return "Global";

  const zones = (persona.persona_zones ?? [])
    .filter((item) => item.is_active && item.zones)
    .map((item) => `${item.zones!.code} · ${item.zones!.name}`);
  if (zones.length) return zones.join(", ");

  const clusters = (persona.persona_clusters ?? [])
    .filter((item) => item.is_active && item.clusters)
    .map((item) => `${item.clusters!.code} · ${item.clusters!.name}`);
  if (clusters.length) return `Cluster: ${clusters.join(", ")}`;

  const stores = (persona.persona_stores ?? [])
    .filter((item) => item.is_active && item.stores)
    .map((item) => `${item.stores!.code} · ${item.stores!.name}`);
  if (stores.length) {
    return persona.role === "supervisor"
      ? `KIO/SES: ${stores.join(", ")}`
      : stores.join(", ");
  }

  return "Sin asignación";
}

export function PersonalManagement({
  actorRole,
  personas,
  stores,
  puestos,
  zones,
  clusters,
  permissions,
}: Props) {
  const canCreate = permissions.includes(PERMISSIONS.peopleCreate);
  const canUpdate = permissions.includes(PERMISSIONS.peopleUpdate);
  const allowedRoles = rolesForActor(actorRole);
  const firstRole = allowedRoles[0] ?? "promotor";

  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PersonaRow | null>(null);
  const [createRole, setCreateRole] = useState<Role>(firstRole);
  const [createScope, setCreateScope] = useState<ScopeType>(defaultScope(firstRole));
  const [createPuesto, setCreatePuesto] = useState("");
  const [editRole, setEditRole] = useState<Role>("promotor");
  const [editScope, setEditScope] = useState<ScopeType>("store");
  const [editPuesto, setEditPuesto] = useState("");

  const [createState, createAction, createPending] = useActionState(
    createPersonUnified,
    initialState,
  );
  const [updateState, updateAction, updatePending] = useActionState(
    updatePersonUnified,
    initialState,
  );

  const sortedPersonas = useMemo(
    () =>
      [...personas].sort((a, b) =>
        `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`, "es"),
      ),
    [personas],
  );

  useEffect(() => {
    if (createState.ok) setCreateOpen(false);
  }, [createState]);

  useEffect(() => {
    if (updateState.ok) setEditing(null);
  }, [updateState]);

  useEffect(() => {
    if (!editing) return;
    setEditRole(editing.role);
    setEditScope(scopeForPersona(editing));
    setEditPuesto(editing.puesto_id);
  }, [editing]);

  function defaultPuestoForRole(role: Role) {
    return puestos.find((puesto) => puesto.code === standardPositionCode(role))?.id ?? puestos[0]?.id ?? "";
  }

  function changeCreateRole(role: Role) {
    setCreateRole(role);
    setCreateScope(defaultScope(role));
    setCreatePuesto(defaultPuestoForRole(role));
  }

  function changeEditRole(role: Role) {
    setEditRole(role);
    setEditScope(defaultScope(role));
    setEditPuesto(defaultPuestoForRole(role));
  }

  function openCreate() {
    const role = allowedRoles[0] ?? "promotor";
    setCreateRole(role);
    setCreateScope(defaultScope(role));
    setCreatePuesto(defaultPuestoForRole(role));
    setCreateOpen(true);
  }

  function canEdit(persona: PersonaRow) {
    if (!canUpdate) return false;
    if (actorRole === "admin") return true;
    if (actorRole === "zonal") return persona.role === "supervisor" || persona.role === "promotor";
    if (actorRole === "supervisor") return persona.role === "promotor";
    return false;
  }

  return (
    <div className="space-y-4">
      {createState.ok && createState.message && <ActionMessage state={createState} />}
      {updateState.ok && updateState.message && <ActionMessage state={updateState} />}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Personas</h2>
            <p className="mt-1 text-xs text-slate-500">
              Persona, puesto, rol, cuenta y alcance se administran de forma independiente.
            </p>
          </div>
          {canCreate && allowedRoles.length > 0 && (
            <PrimaryButton onClick={openCreate}>Nueva persona</PrimaryButton>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-5 py-3 font-medium">Documento</th>
                <th className="px-5 py-3 font-medium">Puesto</th>
                <th className="px-5 py-3 font-medium">Rol</th>
                <th className="px-5 py-3 font-medium">Alcance</th>
                <th className="px-5 py-3 font-medium">Usuario</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedPersonas.map((persona) => (
                <tr key={persona.id} className="hover:bg-slate-50/60">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{persona.first_name} {persona.last_name}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{persona.phone || "Sin teléfono"}</p>
                  </td>
                  <td className="px-5 py-4 text-slate-600">{persona.document || "—"}</td>
                  <td className="px-5 py-4 text-slate-600">{persona.puestos?.name || "—"}</td>
                  <td className="px-5 py-4"><RoleBadge role={persona.role} /></td>
                  <td className="max-w-80 px-5 py-4 text-xs leading-5 text-slate-600">{scopeLabel(persona)}</td>
                  <td className="px-5 py-4 text-slate-600">{persona.email || "Sin usuario"}</td>
                  <td className="px-5 py-4"><Status active={persona.is_active} /></td>
                  <td className="px-5 py-4 text-right">
                    {canEdit(persona) ? (
                      <button
                        type="button"
                        onClick={() => setEditing(persona)}
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
              {sortedPersonas.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-slate-400">No hay personas dentro de tu alcance.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={createOpen}
        title="Nueva persona"
        description="Define datos personales, puesto, rol, alcance territorial y credenciales."
        onClose={() => { if (!createPending) setCreateOpen(false); }}
      >
        <form action={createAction} className="space-y-4">
          <PersonFields />
          <RoleSelect value={createRole} roles={allowedRoles} onChange={changeCreateRole} />
          <PuestoSelect value={createPuesto} puestos={puestos} onChange={setCreatePuesto} />
          <ScopeFields
            role={createRole}
            scope={createScope}
            onScopeChange={setCreateScope}
            zones={zones}
            clusters={clusters}
            stores={stores}
          />
          <CredentialsFields passwordName="initial_password" passwordLabel="Contraseña inicial" required />
          {!createState.ok && createState.message && <ActionMessage state={createState} />}
          <ModalActions onCancel={() => setCreateOpen(false)} pending={createPending} label="Crear persona" />
        </form>
      </Modal>

      <Modal
        open={Boolean(editing)}
        title="Editar persona"
        description="Actualiza puesto, rol, alcance, estado y credenciales sin mezclar responsabilidades."
        onClose={() => { if (!updatePending) setEditing(null); }}
      >
        {editing && (
          <form action={updateAction} className="space-y-4">
            <input type="hidden" name="persona_id" value={editing.id} />
            <input type="hidden" name="user_id" value={editing.user_id ?? ""} />
            <PersonFields persona={editing} />
            <RoleSelect
              value={editRole}
              roles={ensureCurrentRole(allowedRoles, editing.role)}
              onChange={changeEditRole}
            />
            <PuestoSelect value={editPuesto} puestos={puestos} onChange={setEditPuesto} />
            <ScopeFields
              role={editRole}
              scope={editScope}
              onScopeChange={setEditScope}
              zones={zones}
              clusters={clusters}
              stores={stores}
              persona={editing}
            />
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-slate-600">Estado</span>
              <select name="is_active" defaultValue={editing.is_active ? "true" : "false"} className="control-input">
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
            <CredentialsFields
              email={editing.email ?? ""}
              passwordName="new_password"
              passwordLabel={editing.user_id ? "Nueva contraseña" : "Contraseña para crear acceso"}
              required={!editing.user_id}
            />
            {!updateState.ok && updateState.message && <ActionMessage state={updateState} />}
            <ModalActions onCancel={() => setEditing(null)} pending={updatePending} label="Guardar cambios" />
          </form>
        )}
      </Modal>
    </div>
  );
}

function PersonFields({ persona }: { persona?: PersonaRow }) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nombres" name="first_name" defaultValue={persona?.first_name ?? ""} required />
        <Field label="Apellidos" name="last_name" defaultValue={persona?.last_name ?? ""} required />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Documento" name="document" defaultValue={persona?.document ?? ""} placeholder="DNI / documento" />
        <Field label="Teléfono" name="phone" defaultValue={persona?.phone ?? ""} placeholder="Celular / teléfono" />
      </div>
    </>
  );
}

function CredentialsFields({
  email = "",
  passwordName,
  passwordLabel,
  required,
}: {
  email?: string;
  passwordName: string;
  passwordLabel: string;
  required: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Acceso al sistema</p>
      <div className="mt-3 space-y-3">
        <Field label="Usuario / correo" name="email" type="email" defaultValue={email} required />
        <Field
          label={passwordLabel}
          name={passwordName}
          type="password"
          placeholder={required ? "Mínimo 8 caracteres" : "Vacío = conservar actual"}
          required={required}
        />
      </div>
    </div>
  );
}

function RoleSelect({ value, roles, onChange }: { value: Role; roles: Role[]; onChange: (role: Role) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">Rol del sistema</span>
      <select name="role" value={value} onChange={(event) => onChange(event.target.value as Role)} className="control-input">
        {roles.map((role) => <option key={role} value={role}>{roleLabel(role)}</option>)}
      </select>
      <span className="mt-1 block text-[11px] text-slate-400">El rol define permisos; no define el territorio.</span>
    </label>
  );
}

function PuestoSelect({ value, puestos, onChange }: { value: string; puestos: PuestoRow[]; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">Puesto</span>
      <select name="puesto_id" value={value} onChange={(event) => onChange(event.target.value)} className="control-input" required>
        <option value="" disabled>Selecciona un puesto</option>
        {puestos.map((puesto) => <option key={puesto.id} value={puesto.id}>{puesto.name}</option>)}
      </select>
      <span className="mt-1 block text-[11px] text-slate-400">El puesto representa la función organizacional.</span>
    </label>
  );
}

function ScopeFields({
  role,
  scope,
  onScopeChange,
  zones,
  clusters,
  stores,
  persona,
}: {
  role: Role;
  scope: ScopeType;
  onScopeChange: (scope: ScopeType) => void;
  zones: ZoneRow[];
  clusters: ClusterRow[];
  stores: StoreRow[];
  persona?: PersonaRow;
}) {
  const zoneDefault = persona?.persona_zones?.find((item) => item.is_active)?.zone_id ?? "";
  const clusterDefault = persona?.persona_clusters?.find((item) => item.is_active)?.cluster_id ?? "";
  const storeDefaults = (persona?.persona_stores ?? []).filter((item) => item.is_active).map((item) => item.store_id);

  if (role === "admin") return <input type="hidden" name="scope_type" value="global" />;

  if (role === "zonal") {
    return (
      <div className="rounded-xl border border-slate-200 p-4">
        <input type="hidden" name="scope_type" value="zone" />
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Zona asignada</span>
          <select name="zone_id" defaultValue={zoneDefault} className="control-input" required>
            <option value="" disabled>Selecciona una zona</option>
            {zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.code} · {zone.name}</option>)}
          </select>
        </label>
      </div>
    );
  }

  if (role === "supervisor") {
    return (
      <div className="space-y-3 rounded-xl border border-slate-200 p-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Tipo de supervisión</span>
          <select
            name="scope_type"
            value={scope}
            onChange={(event) => onScopeChange(event.target.value as ScopeType)}
            className="control-input"
          >
            <option value="stores">Supervisor KIO/SES · tiendas directas</option>
            <option value="cluster">Supervisor Cluster</option>
          </select>
        </label>
        {scope === "cluster" ? (
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-slate-600">Cluster asignado</span>
            <select name="cluster_id" defaultValue={clusterDefault} className="control-input" required>
              <option value="" disabled>Selecciona un cluster</option>
              {clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.code} · {cluster.name}</option>)}
            </select>
          </label>
        ) : (
          <StoreMultiSelect stores={stores} defaultValues={storeDefaults} />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <input type="hidden" name="scope_type" value="store" />
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-slate-600">Tienda asignada</span>
        <select name="store_ids" defaultValue={storeDefaults[0] ?? ""} className="control-input" required>
          <option value="" disabled>Selecciona una tienda</option>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}
        </select>
      </label>
    </div>
  );
}

function StoreMultiSelect({ stores, defaultValues }: { stores: StoreRow[]; defaultValues: string[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-slate-600">Tiendas directas</span>
      <select name="store_ids" multiple defaultValue={defaultValues} className="control-input min-h-32" required>
        {stores.map((store) => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}
      </select>
      <span className="mt-1 block text-[11px] text-slate-400">Puedes seleccionar varias tiendas. Este alcance se identifica como Supervisor KIO/SES.</span>
    </label>
  );
}

function ensureCurrentRole(roles: Role[], current: Role) {
  return roles.includes(current) ? roles : [current, ...roles];
}

function RoleBadge({ role }: { role: Role }) {
  const styles = role === "admin"
    ? "bg-slate-950 text-white"
    : role === "zonal"
      ? "bg-indigo-50 text-indigo-700"
      : role === "supervisor"
        ? "bg-blue-50 text-blue-700"
        : "bg-emerald-50 text-emerald-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles}`}>{roleLabel(role)}</span>;
}

function Status({ active }: { active: boolean }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
      {active ? "Activo" : "Inactivo"}
    </span>
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
      <input name={name} type={type} placeholder={placeholder} required={required} defaultValue={defaultValue} className="control-input" />
    </label>
  );
}

function PrimaryButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800">{children}</button>;
}

function ActionMessage({ state }: { state: PersonActionState }) {
  if (!state.message) return null;
  return <div className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{state.message}</div>;
}

function ModalActions({ onCancel, pending, label }: { onCancel: () => void; pending: boolean; label: string }) {
  return (
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
      <button type="button" onClick={onCancel} disabled={pending} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
      <button type="submit" disabled={pending} className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">{pending ? "Procesando..." : label}</button>
    </div>
  );
}

function Modal({ open, title, description, onClose, children }: { open: boolean; title: string; description: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
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
          <div><h2 className="text-base font-semibold text-slate-950">{title}</h2><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div>
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-lg text-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Cerrar">×</button>
        </div>
        <div className="p-5">{children}</div>
      </section>
    </div>
  );
}
