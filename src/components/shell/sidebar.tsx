"use client";

import { faCalendarDay } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import {
  DEFAULT_APP_HREF,
  SHELL_NAVIGATION,
} from "@/config/navigation";
import { ShellLink } from "@/components/shell/shell-link";
import { SidebarGroup } from "@/components/shell/sidebar-group";

export function ShellSidebar({
  activeModule,
  activeView,
  collapsed,
  openGroup,
  onGroupToggle,
}: {
  activeModule: string;
  activeView?: string;
  collapsed: boolean;
  openGroup: string | null;
  onGroupToggle: (key: string) => void;
}) {
  return (
    <aside
      className={
        "flex h-dvh flex-col border-r border-slate-200 bg-white transition-[width] duration-300 " +
        (collapsed ? "w-[72px]" : "w-[264px]")
      }
    >
      <div
        className={
          "flex h-16 shrink-0 items-center overflow-hidden border-b border-slate-200 " +
          (collapsed ? "justify-center px-3" : "px-5")
        }
      >
        <ShellLink
          href={DEFAULT_APP_HREF}
          className="flex min-w-0 items-center gap-3"
        >
          <div className="grid size-8 shrink-0 place-items-center rounded-[9px] bg-gradient-to-br from-indigo-600 to-violet-600 text-sm font-bold text-white">
            A
          </div>
          {!collapsed ? (
            <span className="whitespace-nowrap text-[15px] font-semibold tracking-tight text-slate-900">
              AdminGes
            </span>
          ) : null}
        </ShellLink>
      </div>

      <nav
        aria-label="Navegación principal"
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4"
      >
        <div className="mb-5">
          <ShellLink
            href="/ventas/dia"
            title="Día de venta"
            className={
              "flex h-10 items-center rounded-[9px] bg-slate-900 text-white transition hover:bg-slate-800 " +
              (collapsed ? "justify-center px-0" : "gap-3 px-3")
            }
          >
            <FontAwesomeIcon icon={faCalendarDay} className="w-4 shrink-0 text-xs" />
            {!collapsed ? (
              <span className="whitespace-nowrap text-sm font-semibold">
                Día de venta
              </span>
            ) : null}
          </ShellLink>
        </div>

        {SHELL_NAVIGATION.map((section) => (
          <section key={section.label} className="mb-6 last:mb-0">
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {section.label}
              </p>
            ) : (
              <div className="mb-2 h-4" aria-hidden="true" />
            )}

            <div className="space-y-1">
              {section.items.map((item) => (
                <SidebarGroup
                  key={item.key}
                  item={item}
                  activeModule={activeModule}
                  activeView={activeView}
                  open={openGroup === item.key}
                  collapsed={collapsed}
                  onToggle={() => onGroupToggle(item.key)}
                />
              ))}
            </div>
          </section>
        ))}
      </nav>
    </aside>
  );
}
