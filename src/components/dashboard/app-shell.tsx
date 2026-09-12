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
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { signOut } from "@/app/dashboard/actions";
import { PERMISSIONS, type PermissionKey } from "@/lib/auth/permissions";

type NavigationItem = {
  key: string;
  label: string;
  icon: IconDefinition;
  href: string;
  permissions?: readonly PermissionKey[];
};

type NavigationGroup = {
  label: string;
  items: NavigationItem[];
};

type AppShellProps = {
  email: string;
  fullName: string;
  role: "admin" | "supervisor" | "promotor";
  activeModule: string;
  activeView?: string;
  permissions: string[];
  notice?: string;
  children: ReactNode;
};

const navigation: NavigationGroup[] = [
  {
    label: "Principal",
    items: [{ key: "resumen", label: "Resumen", icon: faChartLine, href: "/dashboard" }],
  },
  {
    label: "Administración",
    items: [
      {
        key: "personal",
        label: "Personal",
        icon: faPeopleGroup,
        href: "/dashboard?module=personal&view=promotores",
        permissions: [PERMISSIONS.promotersRead, PERMISSIONS.usersRead],
      },
      {
        key: "tiendas",
        label: "Tiendas",
        icon: faShop,
        href: "/dashboard?module=tiendas",
        permissions: [PERMISSIONS.storesRead],
      },
    ],
  },
  {
    label: "Operación",
    items: [
      {
        key: "inventario",
        label: "Inventario",
        icon: faBoxesStacked,
        href: "/dashboard?module=inventario",
        permissions: [PERMISSIONS.inventoryRead],
      },
      {
        key: "ventas",
        label: "Ventas",
        icon: faReceipt,
        href: "/dashboard?module=ventas",
        permissions: [PERMISSIONS.salesRead],
      },
    ],
  },
  {
    label: "Gestión comercial",
    items: [
      {
        key: "horarios",
        label: "Horarios",
        icon: faClock,
        href: "/dashboard?module=horarios",
        permissions: [PERMISSIONS.schedulesRead],
      },
      {
        key: "cuotas",
        label: "Cuotas",
        icon: faBullseye,
        href: "/dashboard?module=cuotas",
        permissions: [PERMISSIONS.quotasRead],
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
        permissions: [PERMISSIONS.analyticsRead],
      },
    ],
  },
];

const moduleTitles: Record<string, string> = {
  resumen: "Resumen",
  personal: "Personal",
  tiendas: "Tiendas",
  inventario: "Inventario",
  ventas: "Ventas",
  horarios: "Horarios",
  cuotas: "Cuotas",
  analisis: "Análisis",
};

const viewLabels: Record<string, string> = {
  promotores: "Promotores",
  usuarios: "Usuarios internos",
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

export function AppShell({
  email,
  fullName,
  role,
  activeModule,
  activeView,
  permissions,
  notice,
  children,
}: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("adminges.sidebar.collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [activeModule, activeView]);

  const visibleNavigation = useMemo(
    () =>
      navigation
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              !item.permissions ||
              item.permissions.some((permission) => permissions.includes(permission)),
          ),
        }))
        .filter((group) => group.items.length > 0),
    [permissions],
  );

  const currentTitle = moduleTitles[activeModule] ?? "Resumen";
  const currentView = activeView ? viewLabels[activeView] : undefined;
  const avatar = initials(fullName, email);
  const roleLabel =
    role === "admin" ? "Administrador" : role === "supervisor" ? "Supervisor" : "Promotor";

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
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-slate-950">
            A
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="truncate text-sm font-bold tracking-[0.18em] text-white">ADMINGES</div>
              <div className="truncate text-[11px] text-slate-500">Gestión comercial</div>
            </div>
          )}
        </Link>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {visibleNavigation.map((group) => (
          <div key={group.label} className="mb-6 last:mb-0">
            {!collapsed && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                {group.label}
              </p>
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = activeModule === item.key;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 transition-colors ${
                      collapsed ? "justify-center" : ""
                    } ${
                      isActive
                        ? "bg-white text-slate-950"
                        : "text-slate-400 hover:bg-slate-900 hover:text-white"
                    }`}
                  >
                    <FontAwesomeIcon icon={item.icon} className="w-4 shrink-0" />
                    {!collapsed && <span className="truncate text-sm font-medium">{item.label}</span>}
                  </Link>
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
                {currentView && (
                  <>
                    <span>/</span>
                    <span>{currentView}</span>
                  </>
                )}
              </div>
              <h1 className="truncate text-base font-semibold text-slate-950 md:text-lg">
                {currentTitle}
              </h1>
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
                <div className="grid size-8 place-items-center rounded-lg bg-slate-950 text-xs font-semibold text-white">
                  {avatar}
                </div>
                <div className="hidden min-w-0 sm:block">
                  <div className="max-w-40 truncate text-xs font-semibold text-slate-900">
                    {fullName || email}
                  </div>
                  <div className="text-[10px] text-slate-500">{roleLabel}</div>
                </div>
                <FontAwesomeIcon
                  icon={faChevronDown}
                  className="hidden text-[10px] text-slate-400 sm:block"
                />
              </button>

              {userOpen && (
                <div className="absolute right-0 top-[calc(100%+8px)] w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl shadow-slate-200/60">
                  <div className="border-b border-slate-100 px-3 py-2.5">
                    <p className="truncate text-sm font-semibold text-slate-950">
                      {fullName || "Usuario"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{email}</p>
                  </div>
                  <button
                    type="button"
                    className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <FontAwesomeIcon icon={faUser} className="w-4" />
                    Mi perfil
                  </button>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-600 hover:bg-slate-50"
                  >
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
            {notice && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {notice}
              </div>
            )}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
