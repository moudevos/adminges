"use client";

import { faBars } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { UserMenu } from "@/components/shell/user-menu";

type ShellTopbarProps = {
  email: string;
  moduleTitle: string;
  viewTitle?: string;
  collapsed: boolean;
  onOpenMobile: () => void;
  onToggleCollapse: () => void;
};

export function ShellTopbar({
  email,
  moduleTitle,
  viewTitle,
  collapsed,
  onOpenMobile,
  onToggleCollapse,
}: ShellTopbarProps) {
  const showView = Boolean(viewTitle && viewTitle !== moduleTitle);

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      <button
        type="button"
        onClick={onOpenMobile}
        className="grid size-9 place-items-center rounded-[9px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:hidden"
        aria-label="Abrir menú"
      >
        <FontAwesomeIcon icon={faBars} />
      </button>

      <button
        type="button"
        onClick={onToggleCollapse}
        className="hidden size-9 place-items-center rounded-[9px] text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 md:grid"
        aria-label={collapsed ? "Expandir menú lateral" : "Contraer menú lateral"}
      >
        <FontAwesomeIcon icon={faBars} />
      </button>

      <div className="min-w-0">
        <h1 className="truncate text-[17px] font-semibold tracking-tight text-slate-900">
          {moduleTitle}
        </h1>
        {showView ? (
          <p className="truncate text-[11px] font-medium text-slate-400">
            {viewTitle}
          </p>
        ) : null}
      </div>

      <div className="flex-1" />
      <UserMenu email={email} />
    </header>
  );
}
