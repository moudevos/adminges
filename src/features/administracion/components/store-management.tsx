"use client";

import {
  useEffect,
  useMemo,
  useState,
  useTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  saveTienda,
  type AdminActionState,
} from "@/features/administracion/server/actions";

type Relation<T> = T | T[] | null | undefined;
type Store = {
  id: string;
  codigo: string;
  nombre: string;
  direccion: string | null;
  email: string | null;
  zona_id: string;
  latitude: number | null;
  longitude: number | null;
  radio_metros: number | null;
  categoria: string | null;
  tipo: string | null;
  is_active: boolean;
  zonas?: Relation<{ nombre: string }>;
};
type Person = {
  id: string;
  nombres: string;
  apellidos: string;
  documento: string | null;
  is_active: boolean;
  puestos?: Relation<{ nombre: string }>;
};
type Zone = { id: string; nombre: string; is_active: boolean };
type TeamAssignment = {
  tienda_id: string;
  persona_id?: string | null;
  user_id?: string | null;
  valid_from: string;
  valid_to: string | null;
};
type Profile = { user_id: string; persona_id: string | null };
type Data = {
  tiendas: Store[];
  zonas: Zone[];
  personas: Person[];
  supervisors: TeamAssignment[];
  promoters: TeamAssignment[];
  profiles: Profile[];
};
type StoreDraft = {
  codigo: string;
  nombre: string;
  direccion: string;
  email: string;
  zonaId: string;
  categoria: "Oro" | "Plata" | "Bronce";
  tipo: "SES" | "KIOSKO";
  latitude: string;
  longitude: string;
  radioMetros: string;
  isActive: boolean;
};

const emptyDraft = (): StoreDraft => ({
  codigo: "",
  nombre: "",
  direccion: "",
  email: "",
  zonaId: "",
  categoria: "Oro",
  tipo: "SES",
  latitude: "",
  longitude: "",
  radioMetros: "50",
  isActive: true,
});

function firstRelation<T>(value: Relation<T>): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}
function positionName(person: Person): string {
  return firstRelation(person.puestos)?.nombre.trim().toLowerCase() ?? "";
}
function personLabel(person: Person): string {
  return `${person.nombres} ${person.apellidos}${person.documento ? ` · ${person.documento}` : ""
    }`;
}
function initials(person: Person): string {
  return `${person.nombres.charAt(0)}${person.apellidos.charAt(0)}`.toUpperCase();
}

/* ---------- Piezas pequeñas ---------- */

type Tone = "green" | "amber" | "blue" | "slate" | "yellow" | "violet";

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    amber: "bg-amber-50 text-amber-700 ring-amber-600/20",
    yellow: "bg-yellow-50 text-yellow-800 ring-yellow-600/30",
    blue: "bg-sky-50 text-sky-700 ring-sky-600/20",
    violet: "bg-violet-50 text-violet-700 ring-violet-600/20",
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

const categoryTone: Record<string, Tone> = {
  Oro: "yellow",
  Plata: "slate",
  Bronce: "amber",
};

function Avatar({ person, size = "md" }: { person: Person; size?: "sm" | "md" }) {
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 font-semibold text-white shadow-sm ${dims}`}
    >
      {initials(person)}
    </span>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-slate-800">{value}</dd>
    </div>
  );
}

function PersonSummary({
  person,
  compact = false,
}: {
  person: Person;
  compact?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <Avatar person={person} size={compact ? "sm" : "md"} />
      <div>
        <p className="text-sm font-medium text-slate-800">
          {person.nombres} {person.apellidos}
        </p>
        <p className="text-xs text-slate-500">
          {person.documento ?? "Sin documento"}
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  className = "",
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`}>
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div>
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        {description && (
          <p className="text-xs text-slate-500">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function SearchIcon() {
  return (
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
  );
}

/* ---------- Vista principal ---------- */

export function StoreManagement({ data }: { data: Data }) {
  const [open, setOpen] = useState(false);
  const [detailStoreId, setDetailStoreId] = useState<string | null>(null);
  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [tab, setTab] = useState<"data" | "team">("data");
  const [draft, setDraft] = useState<StoreDraft>(emptyDraft);
  const [supervisorId, setSupervisorId] = useState("");
  const [promoterIds, setPromoterIds] = useState<string[]>([]);
  const [promoterSearch, setPromoterSearch] = useState("");
  const [message, setMessage] = useState<AdminActionState>({
    ok: false,
    message: "",
  });
  const [pending, startTransition] = useTransition();

  // Filtros de la tabla
  const [search, setSearch] = useState("");
  const [zoneFilter, setZoneFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">(
    "all",
  );

  const supervisors = useMemo(
    () =>
      data.personas.filter(
        (person) => person.is_active && positionName(person) === "supervisor",
      ),
    [data.personas],
  );

  const promoters = useMemo(() => {
    const query = promoterSearch.trim().toLowerCase();
    return data.personas.filter(
      (person) =>
        person.is_active &&
        positionName(person) === "promotor" &&
        (!query || personLabel(person).toLowerCase().includes(query)),
    );
  }, [data.personas, promoterSearch]);

  const stats = useMemo(
    () => ({
      total: data.tiendas.length,
      activas: data.tiendas.filter((s) => s.is_active).length,
      inactivas: data.tiendas.filter((s) => !s.is_active).length,
      zonas: new Set(data.tiendas.map((s) => s.zona_id)).size,
    }),
    [data.tiendas],
  );

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.tiendas.filter((store) => {
      if (zoneFilter && store.zona_id !== zoneFilter) return false;
      if (statusFilter === "active" && !store.is_active) return false;
      if (statusFilter === "inactive" && store.is_active) return false;
      if (!term) return true;
      return `${store.codigo} ${store.nombre} ${firstRelation(store.zonas)?.nombre ?? ""}`
        .toLowerCase()
        .includes(term);
    });
  }, [data.tiendas, search, zoneFilter, statusFilter]);

  const updateDraft = <K extends keyof StoreDraft>(key: K, value: StoreDraft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const personById = (id: string) =>
    data.personas.find((candidate) => candidate.id === id) ?? null;
  const profilePersonByUserId = useMemo(
    () =>
      new Map(
        data.profiles.flatMap((profile) =>
          profile.persona_id
            ? [[profile.user_id, profile.persona_id] as const]
            : [],
        ),
      ),
    [data.profiles],
  );
  const activeSupervisorForStore = (storeId: string) =>
    data.supervisors.find(
      (assignment) => assignment.tienda_id === storeId && !assignment.valid_to,
    ) ?? null;
  const activePromoterIdsForStore = (storeId: string) =>
    data.promoters
      .filter(
        (assignment) => assignment.tienda_id === storeId && !assignment.valid_to,
      )
      .map((assignment) => assignment.persona_id)
      .filter((id): id is string => Boolean(id));
  const supervisorPersonId = (storeId: string) => {
    const assignment = activeSupervisorForStore(storeId);
    return (
      assignment?.persona_id ??
      (assignment?.user_id
        ? (profilePersonByUserId.get(assignment.user_id) ?? null)
        : null)
    );
  };
  const detailStore = detailStoreId
    ? (data.tiendas.find((store) => store.id === detailStoreId) ?? null)
    : null;
  const detailSupervisor = detailStore
    ? activeSupervisorForStore(detailStore.id)
    : null;
  const detailSupervisorPerson = detailSupervisor
    ? personById(
      detailSupervisor.persona_id ??
      (detailSupervisor.user_id
        ? (profilePersonByUserId.get(detailSupervisor.user_id) ?? "")
        : ""),
    )
    : null;
  const detailPromoters = detailStore
    ? activePromoterIdsForStore(detailStore.id)
      .map((personId) => personById(personId))
      .filter((person): person is Person => person !== null)
    : [];

  const openCreateModal = () => {
    setDraft(emptyDraft());
    setEditingStoreId(null);
    setTab("data");
    setSupervisorId("");
    setPromoterIds([]);
    setPromoterSearch("");
    setMessage({ ok: false, message: "" });
    setOpen(true);
  };
  const openEditModal = (store: Store, initialTab: "data" | "team" = "data") => {
    const category =
      store.categoria === "Plata" || store.categoria === "Bronce"
        ? store.categoria
        : "Oro";
    const type = store.tipo === "KIOSKO" ? "KIOSKO" : "SES";
    setDraft({
      codigo: store.codigo,
      nombre: store.nombre,
      direccion: store.direccion ?? "",
      email: store.email ?? "",
      zonaId: store.zona_id,
      categoria: category,
      tipo: type,
      latitude: store.latitude === null ? "" : String(store.latitude),
      longitude: store.longitude === null ? "" : String(store.longitude),
      radioMetros: String(store.radio_metros ?? 50),
      isActive: store.is_active,
    });
    setEditingStoreId(store.id);
    setSupervisorId(supervisorPersonId(store.id) ?? "");
    setPromoterIds(activePromoterIdsForStore(store.id));
    setPromoterSearch("");
    setMessage({ ok: false, message: "" });
    setTab(initialTab);
    setOpen(true);
  };
  const closeModal = () => {
    if (!pending) setOpen(false);
  };
  const togglePromoter = (personId: string) =>
    setPromoterIds((current) =>
      current.includes(personId)
        ? current.filter((id) => id !== personId)
        : [...current, personId],
    );

  // Escape cierra el modal y se bloquea el scroll del fondo
  useEffect(() => {
    if (!open && !detailStore) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) {
        setOpen(false);
        setDetailStoreId(null);
      }
    };
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, detailStore, pending]);

  const validateDraft = (): string | null => {
    if (!draft.codigo.trim()) return "Ingresa el código de la tienda.";
    if (!draft.nombre.trim()) return "Ingresa el nombre de la tienda.";
    if (!draft.zonaId) return "Selecciona la zona de la tienda.";
    if (draft.email.trim() && !/^\S+@\S+\.\S+$/.test(draft.email.trim()))
      return "Ingresa un correo corporativo válido.";
    const radio = Number(draft.radioMetros);
    if (!Number.isFinite(radio) || radio <= 0 || radio > 10000)
      return "El radio de geocerca debe estar entre 1 y 10 000 metros.";
    const latitude = draft.latitude === "" ? null : Number(draft.latitude);
    const longitude = draft.longitude === "" ? null : Number(draft.longitude);
    if (
      latitude !== null &&
      (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)
    )
      return "La latitud debe estar entre -90 y 90.";
    if (
      longitude !== null &&
      (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)
    )
      return "La longitud debe estar entre -180 y 180.";
    return null;
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateDraft();
    if (validationError) {
      setMessage({ ok: false, message: validationError });
      setTab("data");
      return;
    }
    startTransition(async () => {
      const result = await saveTienda({
        id: editingStoreId ?? undefined,
        codigo: draft.codigo,
        nombre: draft.nombre,
        direccion: draft.direccion,
        email: draft.email,
        zona_id: draft.zonaId,
        categoria: draft.categoria,
        tipo: draft.tipo,
        latitude: draft.latitude === "" ? null : Number(draft.latitude),
        longitude: draft.longitude === "" ? null : Number(draft.longitude),
        radio_metros: Number(draft.radioMetros),
        is_active: draft.isActive,
        supervisor_id: supervisorId || null,
        promotores: promoterIds,
      });
      setMessage(result);
      if (result.ok) setOpen(false);
    });
  };

  const supervisor = supervisorId ? personById(supervisorId) : null;
  const hasFilters = Boolean(search || zoneFilter || statusFilter !== "all");

  return (
    <div className="w-full space-y-6">
      {/* Mensaje de resultado (fuera del modal) */}
      {message.message && !open && (
        <div
          role="status"
          className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${message.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-rose-200 bg-rose-50 text-rose-800"
            }`}
        >
          <span>{message.message}</span>
          <button
            type="button"
            onClick={() => setMessage({ ok: false, message: "" })}
            className="opacity-60 hover:opacity-100"
            aria-label="Cerrar mensaje"
          >
            ✕
          </button>
        </div>
      )}

      {/* Resumen + acción principal */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Total tiendas", value: stats.total, color: "text-slate-900" },
          { label: "Activas", value: stats.activas, color: "text-emerald-600" },
          { label: "Inactivas", value: stats.inactivas, color: "text-slate-500" },
          { label: "Zonas cubiertas", value: stats.zonas, color: "text-indigo-600" },
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
        <div className="col-span-2 flex lg:col-span-1">
          <Button
            type="button"
            onClick={openCreateModal}
            className="h-full min-h-[76px] w-full justify-center rounded-2xl"
          >
            + Nueva tienda
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
          <div className="relative w-full lg:max-w-sm">
            <SearchIcon />
            <input
              className="control-input w-full !pl-9"
              placeholder="Buscar por código, tienda o zona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="flex flex-1 flex-col gap-3 sm:flex-row lg:justify-end">
            <select
              className="control-input sm:w-52"
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              aria-label="Filtrar por zona"
            >
              <option value="">Todas las zonas</option>
              {data.zonas.map((zone) => (
                <option key={zone.id} value={zone.id}>
                  {zone.nombre}
                </option>
              ))}
            </select>
            <select
              className="control-input sm:w-40"
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as typeof statusFilter)
              }
              aria-label="Filtrar por estado"
            >
              <option value="all">Todos</option>
              <option value="active">Activas</option>
              <option value="inactive">Inactivas</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Código</th>
                <th className="px-4 py-3 font-medium">Tienda</th>
                <th className="px-4 py-3 font-medium">Zona</th>
                <th className="px-4 py-3 font-medium">Categoría</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 text-right font-medium">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((store) => (
                <tr
                  key={store.id}
                  className={`transition hover:bg-slate-50/70 ${store.is_active ? "" : "opacity-70"
                    }`}
                >
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-700">
                      {store.codigo}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {store.nombre}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {firstRelation(store.zonas)?.nombre ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {store.categoria ? (
                      <Badge tone={categoryTone[store.categoria] ?? "slate"}>
                        {store.categoria}
                      </Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {store.tipo ? (
                      <Badge tone="violet">{store.tipo}</Badge>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={store.is_active ? "green" : "slate"}>
                      {store.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => setDetailStoreId(store.id)}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Ver
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(store)}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditModal(store, "team")}
                        className="font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
                      >
                        Equipo
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-14 text-center">
                    <p className="text-sm font-medium text-slate-700">
                      {hasFilters
                        ? "Ninguna tienda coincide con los filtros"
                        : "Aún no hay tiendas registradas"}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {hasFilters
                        ? "Prueba con otra búsqueda o limpia los filtros."
                        : "Crea la primera con el botón “Nueva tienda”."}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          {filtered.length} de {data.tiendas.length} tiendas
        </p>
      </section>

      {/* Modal de detalle */}
      {detailStore && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setDetailStoreId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-detail-title"
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
                  Detalle de tienda
                </p>
                <h3
                  id="store-detail-title"
                  className="mt-1 text-xl font-semibold text-slate-900"
                >
                  {detailStore.nombre}
                </h3>
                <p className="mt-1 font-mono text-sm text-slate-500">
                  {detailStore.codigo}
                </p>
              </div>
              <button
                type="button"
                aria-label="Cerrar detalle"
                onClick={() => setDetailStoreId(null)}
                className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                ×
              </button>
            </header>

            <div className="space-y-6 overflow-y-auto px-6 py-5">
              <div className="flex flex-wrap gap-2">
                <Badge tone={detailStore.is_active ? "green" : "slate"}>
                  {detailStore.is_active ? "Activa" : "Inactiva"}
                </Badge>
                {detailStore.categoria && (
                  <Badge tone={categoryTone[detailStore.categoria] ?? "slate"}>
                    {detailStore.categoria}
                  </Badge>
                )}
                {detailStore.tipo && <Badge tone="violet">{detailStore.tipo}</Badge>}
              </div>

              <Section title="Datos de la tienda">
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <Detail
                    label="Zona"
                    value={firstRelation(detailStore.zonas)?.nombre ?? "Sin zona"}
                  />
                  <Detail
                    label="Dirección"
                    value={detailStore.direccion || "Sin dirección registrada"}
                  />
                  <Detail
                    label="Correo corporativo"
                    value={detailStore.email || "Sin correo registrado"}
                  />
                  <Detail
                    label="Geocerca"
                    value={
                      detailStore.latitude !== null &&
                        detailStore.longitude !== null
                        ? `${detailStore.latitude}, ${detailStore.longitude} · ${detailStore.radio_metros ?? 50} m`
                        : `Sin coordenadas · radio ${detailStore.radio_metros ?? 50} m`
                    }
                  />
                </dl>
              </Section>

              <Section
                title="Equipo asociado"
                description="Asignaciones activas de esta tienda."
              >
                <div className="space-y-4">
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Supervisor
                    </p>
                    {detailSupervisorPerson ? (
                      <PersonSummary person={detailSupervisorPerson} />
                    ) : (
                      <p className="text-sm text-slate-500">
                        Sin supervisor asignado.
                      </p>
                    )}
                  </div>
                  <div className="rounded-xl border border-slate-200 p-4">
                    <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
                      Promotores ({detailPromoters.length})
                    </p>
                    {detailPromoters.length ? (
                      <div className="space-y-3">
                        {detailPromoters.map((person) => (
                          <PersonSummary key={person.id} person={person} compact />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">
                        No hay promotores asociados.
                      </p>
                    )}
                  </div>
                </div>
              </Section>
            </div>

            <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setDetailStoreId(null);
                  openEditModal(detailStore);
                }}
              >
                Editar tienda
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setDetailStoreId(null);
                  openEditModal(detailStore, "team");
                }}
              >
                Gestionar equipo
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDetailStoreId(null)}
              >
                Cerrar
              </Button>
            </footer>
          </section>
        </div>
      )}

      {/* Modal crear / editar */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/50 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeModal();
          }}
        >
          <form
            onSubmit={submit}
            role="dialog"
            aria-modal="true"
            aria-labelledby="store-modal-title"
            className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            {/* Cabecera */}
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-6 pb-0 pt-5">
              <div className="w-full">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3
                      id="store-modal-title"
                      className="text-lg font-semibold text-slate-900"
                    >
                      {editingStoreId ? "Editar tienda" : "Nueva tienda"}
                    </h3>
                    <p className="text-sm text-slate-500">
                      {editingStoreId
                        ? "Actualiza sus datos o gestiona su equipo."
                        : "Completa los datos y configura su equipo."}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Cerrar"
                    onClick={closeModal}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                  >
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                </div>

                <div className="mt-4 flex gap-6 text-sm font-medium" role="tablist">
                  {[
                    { id: "data", label: "Datos de tienda", count: null },
                    {
                      id: "team",
                      label: "Equipo",
                      count: (supervisorId ? 1 : 0) + promoterIds.length,
                    },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={tab === t.id}
                      onClick={() => setTab(t.id as "data" | "team")}
                      className={`-mb-px flex items-center gap-2 border-b-2 pb-3 transition ${tab === t.id
                          ? "border-indigo-600 text-indigo-600"
                          : "border-transparent text-slate-500 hover:text-slate-700"
                        }`}
                    >
                      {t.label}
                      {t.count ? (
                        <span className="rounded-full bg-indigo-100 px-1.5 text-xs text-indigo-700">
                          {t.count}
                        </span>
                      ) : null}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Contenido con scroll */}
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-5">
              {message.message && !message.ok && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
                >
                  {message.message}
                </div>
              )}

              {tab === "data" ? (
                <>
                  <Section title="Identificación">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Código *">
                        <input
                          required
                          value={draft.codigo}
                          onChange={(e) => updateDraft("codigo", e.target.value)}
                          className="control-input"
                          placeholder="TDA-001"
                        />
                      </Field>
                      <Field label="Nombre *" className="sm:col-span-2">
                        <input
                          required
                          value={draft.nombre}
                          onChange={(e) => updateDraft("nombre", e.target.value)}
                          className="control-input"
                        />
                      </Field>
                      <Field label="Dirección" className="sm:col-span-2">
                        <input
                          value={draft.direccion}
                          onChange={(e) =>
                            updateDraft("direccion", e.target.value)
                          }
                          className="control-input"
                        />
                      </Field>
                      <Field label="Correo corporativo">
                        <input
                          type="email"
                          value={draft.email}
                          onChange={(e) => updateDraft("email", e.target.value)}
                          className="control-input"
                        />
                      </Field>
                    </div>
                  </Section>

                  <Section title="Clasificación">
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Zona *">
                        <select
                          required
                          value={draft.zonaId}
                          onChange={(e) => updateDraft("zonaId", e.target.value)}
                          className="control-input"
                        >
                          <option value="">Selecciona una zona</option>
                          {data.zonas
                            .filter((zone) => zone.is_active)
                            .map((zone) => (
                              <option key={zone.id} value={zone.id}>
                                {zone.nombre}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field label="Categoría">
                        <select
                          value={draft.categoria}
                          onChange={(e) =>
                            updateDraft(
                              "categoria",
                              e.target.value as StoreDraft["categoria"],
                            )
                          }
                          className="control-input"
                        >
                          <option value="Oro">Oro</option>
                          <option value="Plata">Plata</option>
                          <option value="Bronce">Bronce</option>
                        </select>
                      </Field>
                      <Field label="Tipo">
                        <select
                          value={draft.tipo}
                          onChange={(e) =>
                            updateDraft("tipo", e.target.value as StoreDraft["tipo"])
                          }
                          className="control-input"
                        >
                          <option value="SES">SES</option>
                          <option value="KIOSKO">KIOSKO</option>
                        </select>
                      </Field>
                    </div>
                  </Section>

                  <Section
                    title="Geocerca"
                    description="Define el punto y el radio desde donde se puede registrar actividad."
                  >
                    <div className="grid gap-4 sm:grid-cols-3">
                      <Field label="Latitud">
                        <input
                          type="number"
                          step="any"
                          value={draft.latitude}
                          onChange={(e) => updateDraft("latitude", e.target.value)}
                          className="control-input"
                          placeholder="-3.7491"
                        />
                      </Field>
                      <Field label="Longitud">
                        <input
                          type="number"
                          step="any"
                          value={draft.longitude}
                          onChange={(e) =>
                            updateDraft("longitude", e.target.value)
                          }
                          className="control-input"
                          placeholder="-73.2538"
                        />
                      </Field>
                      <Field label="Radio (m) *">
                        <input
                          type="number"
                          min="1"
                          required
                          value={draft.radioMetros}
                          onChange={(e) =>
                            updateDraft("radioMetros", e.target.value)
                          }
                          className="control-input"
                        />
                      </Field>
                    </div>
                  </Section>

                  <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-indigo-300 hover:bg-indigo-50/40 has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60">
                    <input
                      type="checkbox"
                      checked={draft.isActive}
                      onChange={(e) => updateDraft("isActive", e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="flex flex-col">
                      <span className="text-sm font-medium text-slate-800">
                        Tienda activa
                      </span>
                      <span className="text-xs text-slate-500">
                        Desactívala para ocultarla sin eliminarla.
                      </span>
                    </span>
                  </label>
                </>
              ) : (
                <>
                  <Section
                    title="Supervisor"
                    description="Una persona con puesto Supervisor responsable de la tienda."
                  >
                    <select
                      value={supervisorId}
                      onChange={(e) => setSupervisorId(e.target.value)}
                      className="control-input w-full"
                    >
                      <option value="">Sin supervisor</option>
                      {supervisors.map((person) => (
                        <option key={person.id} value={person.id}>
                          {personLabel(person)}
                        </option>
                      ))}
                    </select>
                    {supervisor && (
                      <div className="rounded-xl bg-slate-50 p-3">
                        <PersonSummary person={supervisor} />
                      </div>
                    )}
                  </Section>

                  <Section
                    title="Promotores"
                    description="Busca y marca los promotores asignados a esta tienda."
                  >
                    <div className="relative">
                      <SearchIcon />
                      <input
                        value={promoterSearch}
                        onChange={(e) => setPromoterSearch(e.target.value)}
                        className="control-input w-full !pl-9"
                        placeholder="Nombre, apellido o documento"
                      />
                    </div>

                    <ul className="max-h-52 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
                      {promoters.map((person) => {
                        const selected = promoterIds.includes(person.id);
                        return (
                          <li key={person.id}>
                            <button
                              type="button"
                              onClick={() => togglePromoter(person.id)}
                              aria-pressed={selected}
                              className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${selected
                                  ? "bg-indigo-50/70"
                                  : "hover:bg-slate-50"
                                }`}
                            >
                              <Avatar person={person} size="sm" />
                              <span className="flex-1 text-sm text-slate-800">
                                {personLabel(person)}
                              </span>
                              <span
                                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${selected
                                    ? "bg-indigo-600 text-white"
                                    : "border border-slate-300 text-transparent"
                                  }`}
                              >
                                ✓
                              </span>
                            </button>
                          </li>
                        );
                      })}
                      {promoters.length === 0 && (
                        <li className="px-3 py-6 text-center text-sm text-slate-500">
                          No se encontraron promotores activos.
                        </li>
                      )}
                    </ul>

                    <div>
                      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                        Seleccionados ({promoterIds.length})
                      </p>
                      {promoterIds.length ? (
                        <div className="flex flex-wrap gap-2">
                          {promoterIds.map((id) => {
                            const person = personById(id);
                            return (
                              <button
                                type="button"
                                key={id}
                                onClick={() => togglePromoter(id)}
                                className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-600/20 transition hover:bg-indigo-100"
                              >
                                {person
                                  ? `${person.nombres} ${person.apellidos}`
                                  : "Persona no disponible"}
                                <span aria-hidden>×</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">
                          Sin promotores agregados.
                        </p>
                      )}
                    </div>
                  </Section>
                </>
              )}
            </div>

            {/* Pie fijo */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 px-6 py-4">
              <Button
                type="button"
                variant="secondary"
                onClick={closeModal}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando..." : "Guardar tienda"}
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}