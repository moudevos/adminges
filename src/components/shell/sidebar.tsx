"use client";

import {
  faChevronLeft,
  faChevronRight,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { SHELL_NAVIGATION } from "@/components/shell/navigation";
import { ShellLink } from "@/components/shell/shell-link";

type ShellSidebarProps = {
  activeModule: string;
  collapsed: boolean;
  onToggleCollapse: () => void;
};

export function ShellSidebar({
  activeModule,
  collapsed,
  onToggleCollapse,
}: ShellSidebarProps) {
  return (
    <aside
      className={`flex h-dvh flex-col border-r border-slate-200 bg-white transition-[width] duration-300 ${
        collapsed ? "w-[72px]" : "w-[264px]"
      }`}
    >
      <div className="flex h-16 shrink-0 items-center gap-3 overflow-hidden border-b border-slate-200 px-5">
        <ShellLink
          href="/dashboard?module=inventario&view=stock"
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

      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {SHELL_NAVIGATION.map((group) => (
          <section key={group.label} className="mb-6 last:mb-0">
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-400">
                {group.label}
              </p>
            ) : (
              <div className="mb-2 h-4" aria-hidden="true" />
            )}

            <div className="space-y-1">
              {group.items.map((item) => {
                const active = activeModule === item.key;

                return (
                  <ShellLink
                    key={item.key}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={`flex h-10 items-center rounded-[9px] font-medium transition-colors ${
                      collapsed ? "justify-center px-0" : "gap-3 px-3"
                    } ${
                      active
                        ? "bg-indigo-50 text-indigo-600"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <FontAwesomeIcon icon={item.icon} className="w-4 shrink-0" />
                    {!collapsed ? (
                      <span className="min-w-0 flex-1 truncate text-sm">{item.label}</span>
                    ) : (
                      <span className="sr-only">{item.label}</span>
                    )}
                  </ShellLink>
                );
              })}
            </div>
          </section>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="hidden h-10 w-full items-center justify-center gap-2 rounded-[9px] text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:flex"
          aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
        >
          <FontAwesomeIcon icon={collapsed ? faChevronRight : faChevronLeft} />
          {!collapsed ? <span>Contraer</span> : null}
        </button>
      </div>
    </aside>
  );
}
