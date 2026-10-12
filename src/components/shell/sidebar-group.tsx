"use client";

import type { NavigationItem } from "@/components/shell/navigation";
import { SidebarItem } from "@/components/shell/sidebar-item";
import { SidebarSubitem } from "@/components/shell/sidebar-subitem";

export function SidebarGroup({ item, activeModule, activeView, open, collapsed, onToggle }: { item: NavigationItem; activeModule: string; activeView?: string; open: boolean; collapsed: boolean; onToggle: () => void }) {
  const active = activeModule === item.key;
  return <div>
    <SidebarItem item={item} active={active} expanded={open} collapsed={collapsed} onClick={onToggle} />
    {!collapsed ? <div className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}><div className="min-h-0 overflow-hidden"><div id={`sidebar-group-${item.key}`} className="my-1 ml-5 border-l border-slate-200 py-0.5 pl-2">
      {item.children.map((child) => <SidebarSubitem key={child.key} item={child} active={active && (child.key === activeView || (!activeView && child.key === item.key))} />)}
    </div></div></div> : null}
  </div>;
}
