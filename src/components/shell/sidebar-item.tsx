"use client";

import { faChevronRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import type { NavigationItem } from "@/config/navigation";

export function SidebarItem({ item, active, expanded, collapsed, onClick }: { item: NavigationItem; active: boolean; expanded: boolean; collapsed: boolean; onClick: () => void }) {
  return <button type="button" title={collapsed ? item.label : undefined} aria-expanded={collapsed ? undefined : expanded} aria-controls={collapsed ? undefined : `sidebar-group-${item.key}`} onClick={onClick} className={`flex h-10 w-full items-center rounded-[9px] font-medium transition-colors ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${active ? "bg-indigo-50 text-indigo-600" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"}`}>
    <FontAwesomeIcon icon={item.icon} className="w-4 shrink-0" />
    {collapsed ? <span className="sr-only">{item.label}</span> : <span className="min-w-0 flex-1 truncate text-left text-sm">{item.label}</span>}
    {!collapsed ? <FontAwesomeIcon icon={faChevronRight} className={`w-3 text-slate-400 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} /> : null}
  </button>;
}
