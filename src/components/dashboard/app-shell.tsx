"use client";

import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";
import {
  faBars,
  faBell,
  faBoxesStacked,
  faBullseye,
  faChartLine,
  faChevronDown,
  faChevronLeft,
  faChevronRight,
  faClock,
  faGear,
  faPeopleGroup,
  faReceipt,
  faRightFromBracket,
  faShop,
  faUser,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/app/dashboard/actions";

type ChildItem = {
  label: string;
  href: string;
  view: string;
};

type NavigationItem = {
  key: string;
  label: string;
  icon: IconDefinition;
  href: string;
  children?: ChildItem[];
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

type AppShellProps = {
  email: string;
  fullName: string;
  role: "admin" | "supervisor";
  activeModule: string;
  activeView?: string;
};

const navigation: NavigationGroup[] = [
  {
    label: "Principal",
    items: [
      {
        key: "resumen",
        label: "Resumen",
        icon: faChartLine,
        href: "/dashboard",
      },
    ],
  },
  {
    label: "Operación",
    items: [
      {
        key: "tiendas",
        label: "Tiendas",
        icon: faShop,
        href: "/dashboard?module=tiendas",
        children: [
          { label: "Vista general", view: "general", href: "/dashboard?module=tiendas&view=general" },
          { label: "Asignaciones", view: "asignaciones", href: "/dashboard?module=tiendas&view=asignaciones" },
        ],
      },
      {
        key: "inventario",
        label: "Inventario",
        icon: faBoxesStacked,
        href: "/dashboard?module=inventario",
        children: [
          { label: "Stock actual", view: "stock", href: "/dashboard?module=inventario&view=stock" },
          { label: "Movimientos", view: "movimientos", href: "/dashboard?module=inventario&view=movimientos" },
        ],
      },
      {
        key: "ventas",
        label: "Ventas",
        icon: faReceipt,
        href: "/dashboard?module=ventas",
        children: [
          { label: "Registro", view: "registro", href: "/dashboard?module=ventas&view=registro" },
          { label: "Historial", view: "historial", href: "/dashboard?module=ventas&view=historial" },
        ],
      },
    ],
  },
  {
    label: "Gestión comercial",
    items: [
      {
        key: "promotores",
        label: "Promotores",
        icon: faPeopleGroup,
        href: "/dashboard?module=promotores",
        children: [
          { label: "Directorio", view: "directorio", href: "/dashboard?module=promotores&view=directorio" },
          { label: "Rendimiento", view: "rendimiento", href: "/dashboard?module=promotores&view=rendimiento" },
        ],
      },
      {
        key: "horarios",
        label: "Horarios",
        icon: faClock,
        href: "/dashboard?module=horarios",
        children: [
          { label: "Programación", view: "programacion", href: "/dashboard?module=horarios&view=programacion" },
          { label: "Seguimiento", view: "seguimiento", href: "/dashboard?module=horarios&view=seguimiento" },
        ],
      },
      {
        key: "cuotas",
        label: "Cuotas",
        icon: faBullseye,
        href: "/dashboard?module=cuotas",
        children: [
          { label: "Mensuales", view: "mensuales", href: "/dashboard?module=cuotas&view=mensuales" },
          { label: "Diarias", view: "diarias", href: "/dashboard?module=cuotas&view=diarias" },
        ],
      },
    ],
  },
  {
    label: "Inteligencia",
    items: [
      {
        key: "analisis",
        label: "Análisis",
        icon: faChartLine,
        href: "/dashboard?module=analisis",
        children: [
          { label: "Ventas", view: "ventas", href: "/dashboard?module=analisis&view=ventas" },
          { label: "Inventario", view: "inventario", href: "/dashboard?module=analisis&view=inventario" },
          { label: "KPIs", view: "kpis", href: "/dashboard?module=analisis&view=kpis" },
        ],
      },
    ],
  },
];

const moduleCopy: Record<string, { title: string; description: string }> = {
  resumen: {
    title: "Resumen",
    description: "Vista ejecutiva de la operación comercial.",
  },
  tiendas: {
    title: "Tiendas",
    description: "Administración de tiendas, responsables y asignaciones.",
  },
  inventario: {
    title: "Inventario",
    description: "Stock, movimientos y comportamiento de productos.",
  },
  ventas: {
    title: "Ventas",
    description: "Registro, seguimiento y evolución de ventas.",
  },
  promotores: {
    title: "Promotores",
    description: "Gestión y rendimiento del equipo comercial.",
  },
  horarios: {
    title: "Horarios",
    description: "Programación y seguimiento operativo del personal.",
  },
  cuotas: {
    title: "Cuotas",
    description: "Objetivos mensuales, diarios y avance de cumplimiento.",
  },
  analisis: {
    title: "Análisis",
    description: "KPIs, tendencias y señales para la toma de decisiones.",
  },
};

const viewLabels: Record<string, string> = {
  general: "Vista general",
  asignaciones: "Asignaciones",
  stock: "Stock actual",
  movimientos: "Movimientos",
  registro: "Registro",
  historial: "Historial",
  directorio: "Directorio",
  rendimiento: "Rendimiento",
  programacion: "Programación",
  seguimiento: "Seguimiento",
  mensuales: "Mensuales",
  diarias: "Diarias",
  ventas: "Ventas",
  inventario: "Inventario",
  kpis: "KPIs",
};

function initials(name: string, email: string) {
  const source = name.trim() || email.split("@")[0] || "U";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function AppShell({ email, fullName, role, activeModule, activeView }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [activeModule]: true });

  useEffect(() => {
    const saved = window.localStorage.getItem("adminges.sidebar.collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    setExpanded((current) => ({ ...current, [activeModule]: true }));
    setMobileOpen(false);
  }, [activeModule, activeView]);

  const current = moduleCopy[activeModule] ?? moduleCopy.resumen;
  const currentView = activeView ? viewLabels[activeView] : undefined;
  const avatar = initials(fullName, email);
  const roleLabel = role === "admin" ? "Administrador" : "Supervisor";

  const activeItem = useMemo(
    () => navigation.flatMap((group) => group.items).find((item) => item.key === activeModule),
    [activeModule],
  );

  function toggleSidebar() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem("adminges.sidebar.collapsed", String(next));
      return next;
    });
  }

  const sidebar = (
    <aside
      className={`flex h-full flex-col border-r border-slate-800 bg-slate-950 text-slate-300 transition-[width] duration-200 ${
        collapsed ? "w-[76px]" : "w-[272px]"
      }`}
    >
      <div className="flex h-16 items-center border-b border-slate-800 px-4">
        <Link href="/dashboard" className="flex min-w-0 items-center gap-3 overflow-hidden">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-slate-950">A</div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-[0.18em] text-white">ADMINGES</div>
              <div className="truncate text-[11px] text-slate-500">Gestión comercial</div>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {navigation.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                {group.label}
              </p>
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeModule === item.key;
                const isExpanded = expanded[item.key] ?? false;

                return (
                  <div key={item.key}>
                    <div
                      className={`group flex items-center rounded-xl transition-colors ${
                        isActive ? "bg-white text-slate-950" : "text-slate-400 hover:bg-slate-900 hover:text-white"
                      }`}
                    >
                      <Link
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 ${collapsed ? "justify-center" : ""}`}
                      >
                        <FontAwesomeIcon icon={item.icon} className="w-4 shrink-0" />
                        {!collapsed && <span className="truncate text-sm font-medium">{item.label}</span>}
                      </Link>

                      {!collapsed && item.children && (
                        <button
                          type="button"
                          onClick={() => setExpanded((current) => ({ ...current, [item.key]: !isExpanded }))}
                          className="mr-1 grid size-8 place-items-center rounded-lg text-xs opacity-70 hover:bg-black/5"
                          aria-label={`${isExpanded ? "Contraer" : "Desplegar"} ${item.label}`}
                        >
                          <FontAwesomeIcon icon={isExpanded ? faChevronDown : faChevronRight} />
                        </button>
                      )}
                    </div>

                    {!collapsed && item.children && isExpanded && (
                      <div className="relative ml-5 mt-1 space-y-1 border-l border-slate-800 pl-4">
                        {item.children.map((child) => {
                          const childActive = isActive && activeView === child.view;
                          return (
                            <Link
                              key={child.view}
                              href={child.href}
                              className={`block rounded-lg px-3 py-2 text-xs transition-colors ${
                                childActive
                                  ? "bg-slate-900 font-medium text-white"
                                  : "text-slate-500 hover:bg-slate-900/70 hover:text-slate-300"
                              }`}
                            >
                              {child.label}
                            </Link>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-slate-800 p-3">
        <button
          type="button"
          onClick={toggleSidebar}
          className="hidden w-full items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-xs text-slate-500 hover:bg-slate-900 hover:text-white md:flex"
        >
          <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          {!collapsed && <span>Contraer menú</span>}
        </button>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen bg-[#f5f6f8] text-slate-950">
      <div className="hidden shrink-0 md:block">{sidebar}</div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
          />
          <div className="relative h-full">{sidebar}</div>
        </div>
      )}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="grid size-9 place-items-center rounded-lg border border-slate-200 text-slate-600 md:hidden"
              aria-label="Abrir menú"
            >
              <FontAwesomeIcon icon={faBars} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                <span>AdminGes</span>
                <span>/</span>
                <span>{currentView ?? "Principal"}</span>
              </div>
              <h1 className="truncate text-base font-semibold text-slate-950 md:text-lg">{current.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="relative grid size-10 place-items-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              aria-label="Notificaciones"
            >
              <FontAwesomeIcon icon={faBell} />
              <span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-rose-500" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setUserOpen((value) => !value)}
                className="flex items-center gap-2 rounded-xl border border-transparent p-1.5 pr-2 text-left hover:border-slate-200 hover:bg-slate-50"
                aria-expanded={userOpen}
              >
                <div className="grid size-8 place-items-center rounded-lg bg-slate-950 text-xs font-semibold text-white">{avatar}</div>
                <div className="hidden min-w-0 sm:block">
                  <div className="max-w-36 truncate text-xs font-semibold text-slate-900">{fullName || email}</div>
                  <div className="text-[10px] text-slate-500">{roleLabel}</div>
                </div>
                <FontAwesomeIcon icon={faChevronDown} className="hidden text-[10px] text-slate-400 sm:block" />
              </button>

              {userOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-slate-950">{fullName || "Usuario"}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>
                  </div>
                  <button type="button" className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                    <FontAwesomeIcon icon={faUser} className="w-4" />
                    Mi perfil
                  </button>
                  <button type="button" className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50">
                    <FontAwesomeIcon icon={faGear} className="w-4" />
                    Preferencias
                  </button>
                  <form action={signOut} className="mt-1 border-t border-slate-100 pt-1">
                    <button className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-rose-600 hover:bg-rose-50">
                      <FontAwesomeIcon icon={faRightFromBracket} className="w-4" />
                      Cerrar sesión
                    </button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-[1500px]">
            <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
              <div>
                <p className="text-sm text-slate-500">{current.description}</p>
                <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">
                  {currentView ?? current.title}
                </h2>
              </div>
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500">
                <span className="size-2 rounded-full bg-emerald-500" />
                Sesión activa
              </div>
            </div>

            {activeModule === "resumen" ? (
              <DashboardOverview />
            ) : (
              <ModulePlaceholder title={current.title} view={currentView} icon={activeItem?.icon ?? faChartLine} />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

function DashboardOverview() {
  const kpis = [
    { label: "Ventas del día", value: "S/ 0.00", note: "Sin datos registrados" },
    { label: "Cumplimiento diario", value: "0%", note: "Cuota pendiente" },
    { label: "Tiendas activas", value: "0", note: "Pendiente de configuración" },
    { label: "Alertas de inventario", value: "0", note: "Sin alertas detectadas" },
  ];

  return (
    <>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((kpi) => (
          <article key={kpi.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
            <p className="text-xs font-medium text-slate-500">{kpi.label}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-950">{kpi.value}</p>
            <p className="mt-2 text-xs text-slate-400">{kpi.note}</p>
          </article>
        ))}
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <article className="min-h-80 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-950">Evolución comercial</h3>
              <p className="mt-1 text-xs text-slate-500">Ventas y cumplimiento de cuota.</p>
            </div>
            <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-500">Mes actual</span>
          </div>
          <div className="mt-8 grid h-52 place-items-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 text-center">
            <div>
              <FontAwesomeIcon icon={faChartLine} className="text-xl text-slate-300" />
              <p className="mt-3 text-sm font-medium text-slate-600">Esperando información de ventas</p>
              <p className="mt-1 text-xs text-slate-400">El gráfico se activará al registrar operaciones.</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-200/30">
          <h3 className="text-sm font-semibold text-slate-950">Actividad reciente</h3>
          <p className="mt-1 text-xs text-slate-500">Últimos eventos relevantes del sistema.</p>
          <div className="mt-6 space-y-4">
            {["Ventas", "Inventario", "Cuotas"].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <div className="size-2 rounded-full bg-slate-300" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-700">{item}</p>
                  <p className="text-xs text-slate-400">Aún no hay actividad registrada.</p>
                </div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

function ModulePlaceholder({ title, view, icon }: { title: string; view?: string; icon: IconDefinition }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm shadow-slate-200/30">
      <div className="grid min-h-[360px] place-items-center text-center">
        <div className="max-w-md">
          <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-slate-950 text-white">
            <FontAwesomeIcon icon={icon} />
          </div>
          <h3 className="mt-5 text-xl font-semibold text-slate-950">{view ?? title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            La estructura de navegación ya está lista. Este espacio recibirá la funcionalidad y los indicadores específicos del módulo {title.toLowerCase()}.
          </p>
        </div>
      </div>
    </section>
  );
}
