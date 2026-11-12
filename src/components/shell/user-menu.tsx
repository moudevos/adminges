"use client";

import {
  faChevronDown,
  faRightFromBracket,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { signOut } from "@/features/auth/server/actions";

function initials(name: string) {
  return (name || "U")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

const roleLabels = {
  owner: { label: "Owner", description: "Administrador general" },
  zonal: { label: "Zonal", description: "Responsable de zona" },
  supervisor: { label: "Supervisor", description: "Responsable de tiendas" },
} as const;

export function UserMenu({ email, name, role }: { email: string; name: string; role: keyof typeof roleLabels | null }) {
  const roleInfo = role ? roleLabels[role] : { label: "Sin rol asignado", description: "Acceso restringido" };
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[10px] px-1 py-1 pr-2 transition hover:bg-slate-100 [&::-webkit-details-marker]:hidden">
        <div className="relative grid size-9 place-items-center rounded-full border border-slate-200 bg-slate-100 text-xs font-semibold text-slate-700">
          {initials(name)}
          <span className="absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white bg-emerald-500" />
        </div>
        <div className="hidden min-w-0 text-left sm:block">
          <div className="max-w-48 truncate text-[13px] font-semibold text-slate-800">
            {name}
          </div>
          <div className="text-xs text-slate-500">{roleInfo.label}</div>
        </div>
        <FontAwesomeIcon
          icon={faChevronDown}
          className="hidden text-[10px] text-slate-400 transition-transform group-open:rotate-180 sm:block"
        />
      </summary>

      <div className="absolute right-0 top-[calc(100%+10px)] z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-[0_12px_32px_rgba(15,20,30,0.14)]">
        <div className="border-b border-slate-100 px-3 py-3">
          <p className="text-xs text-slate-500">Sesión activa</p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {name}
          </p>
          <p className="mt-1 truncate text-xs text-slate-500">{email}</p>
          <p className="mt-2 text-xs font-medium text-indigo-600">{roleInfo.label} — {roleInfo.description}</p>
        </div>
        <form action={signOut} className="pt-1.5">
          <button
            type="submit"
            className="flex h-9 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-sm font-medium text-slate-600 transition hover:bg-rose-50 hover:text-rose-600"
          >
            <FontAwesomeIcon icon={faRightFromBracket} className="w-4" />
            Cerrar sesión
          </button>
        </form>
      </div>
    </details>
  );
}
