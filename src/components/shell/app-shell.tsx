"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { LoadingIndicator } from "@/components/dashboard/loading-indicator";
import {
  resolveNavigationState,
} from "@/components/shell/navigation";
import { ShellNavigationProvider } from "@/components/shell/shell-link";
import { ShellSidebar } from "@/components/shell/sidebar";
import { ShellTopbar } from "@/components/shell/topbar";

type AppShellProps = {
  email: string;
  children: ReactNode;
};

type GroupOverride = {
  pathname: string;
  group: string | null;
};

export function AppShell({ email, children }: AppShellProps) {
  const pathname = usePathname();
  const navigation = resolveNavigationState(pathname);

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [groupOverride, setGroupOverride] = useState<GroupOverride | null>(
    null,
  );
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const openGroup =
    groupOverride?.pathname === pathname
      ? groupOverride.group
      : navigation.activeModule;

  const navigating = Boolean(pendingHref && pendingHref !== pathname);

  function beginNavigation(href: string) {
    const targetPath = new URL(href, "https://adminges.local").pathname;
    const nextNavigation = resolveNavigationState(targetPath);

    setPendingHref(targetPath);
    setMobileOpen(false);
    setGroupOverride({
      pathname: targetPath,
      group: nextNavigation.activeModule,
    });
  }

  function toggleCollapse() {
    setCollapsed((value) => !value);
  }

  function toggleGroup(key: string) {
    if (collapsed) {
      setCollapsed(false);
      setGroupOverride({ pathname, group: key });
      return;
    }

    setGroupOverride({
      pathname,
      group: openGroup === key ? null : key,
    });
  }

  return (
    <ShellNavigationProvider onNavigate={beginNavigation}>
      <div className="flex h-dvh overflow-hidden bg-[#f6f7f9] text-slate-900">
        {navigating ? (
          <LoadingIndicator overlay message="Cambiando de vista..." />
        ) : null}

        <div className="hidden shrink-0 md:block">
          <ShellSidebar
            activeModule={navigation.activeModule}
            activeView={navigation.activeView}
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
                activeModule={navigation.activeModule}
                activeView={navigation.activeView}
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
            moduleTitle={navigation.moduleLabel}
            viewTitle={navigation.viewLabel}
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
