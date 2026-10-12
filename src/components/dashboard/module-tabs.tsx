"use client";

import { ShellLink } from "@/components/shell/shell-link";

export type ModuleTab = {
  key: string;
  label: string;
};

type ModuleTabsProps = {
  module: string;
  tabs: ModuleTab[];
  active: string;
};

export function ModuleTabs({ module, tabs, active }: ModuleTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
      {tabs.map((tab) => (
        <ShellLink
          key={tab.key}
          href={`/dashboard?module=${module}&view=${tab.key}`}
          aria-current={active === tab.key ? "page" : undefined}
          className={`whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition ${
            active === tab.key
              ? "bg-indigo-600 text-white"
              : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          }`}
        >
          {tab.label}
        </ShellLink>
      ))}
    </div>
  );
}
