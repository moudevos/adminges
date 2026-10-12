"use client";

import { usePathname, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { LoadingIndicator } from "@/components/dashboard/loading-indicator";
import { ShellNavigationProvider } from "@/components/shell/shell-link";
import { ShellSidebar } from "@/components/shell/sidebar";
import { ShellTopbar } from "@/components/shell/topbar";

type AppShellProps = {
  email: string;
  activeModule: string;
  activeView?: string;
  children: ReactNode;
};

export function AppShell({
  email,
  activeModule,
  activeView,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const currentHref = query ? `${pathname}?${query}` : pathname;

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(activeModule);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const navigating = Boolean(pendingHref && pendingHref !== currentHref);

  function beginNavigation(href: string) {
    setPendingHref(href);
    setMobileOpen(false);
    const nextModule = new URL(href, "https://adminges.local").searchParams.get("module");
    if (nextModule) setOpenGroup(nextModule);
  }

  function toggleCollapse() {
    setCollapsed((value) => !value);
  }

  function toggleGroup(key: string) {
    if (collapsed) {
      setCollapsed(false);
      setOpenGroup(key);
      return;
    }

    setOpenGroup((value) => (value === key ? null : key));
  }

  return (
    <ShellNavigationProvider onNavigate={beginNavigation}>
      <div className="flex h-dvh overflow-hidden bg-[#f6f7f9] text-slate-900">
        {navigating ? (
          <LoadingIndicator overlay message="Cambiando de vista..." />
        ) : null}

        <div className="hidden shrink-0 md:block">
          <ShellSidebar
            activeModule={activeModule}
            activeView={activeView}
            collapsed={collapsed}
            openGroup={openGroup}
            onGroupToggle={toggleGroup}
          />
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-slate-950/45"
              onClick={() => setMobileOpen(false)}
            />
            <div className="relative h-full shadow-2xl">
              <ShellSidebar
                activeModule={activeModule}
                activeView={activeView}
                collapsed={false}
                openGroup={openGroup}
                onGroupToggle={toggleGroup}
              />
            </div>
          </div>
        ) : null}

        <div className="flex min-w-0 flex-1 flex-col">
          <ShellTopbar
            email={email}
            activeModule={activeModule}
            activeView={activeView}
            collapsed={collapsed}
            onOpenMobile={() => setMobileOpen(true)}
            onToggleCollapse={toggleCollapse}
          />

          <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
            <div className="w-full px-4 py-5 sm:px-6 md:py-7">
              {children}
            </div>
          </main>
        </div>
      </div>
    </ShellNavigationProvider>
  );
}
