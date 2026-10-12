"use client";

import type { NavigationChild } from "@/components/shell/navigation";
import { ShellLink } from "@/components/shell/shell-link";

export function SidebarSubitem({ item, active }: { item: NavigationChild; active: boolean }) {
  return <ShellLink href={item.href} aria-current={active ? "page" : undefined} className={`relative flex h-9 items-center rounded-lg pl-7 pr-3 text-sm font-medium transition-colors ${active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
    {active ? <span aria-hidden="true" className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-indigo-600" /> : null}{item.label}
  </ShellLink>;
}
