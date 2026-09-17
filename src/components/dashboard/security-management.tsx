"use client";

import { useActionState } from "react";
import {
  revokeSession,
  type SecurityActionState,
} from "@/app/dashboard/security-actions";
import { PERMISSIONS } from "@/lib/auth/permissions";

type SessionRow = {
  id: string;
  user_id: string;
  persona_id: string | null;
  client_ip: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revocation_reason: string | null;
  personas: {
    first_name: string;
    last_name: string;
    email: string | null;
  } | null;
};

type Props = {
  sessions: SessionRow[];
  currentSessionId?: string;
  permissions: string[];
};

const initialState: SecurityActionState = { ok: false, message: "" };

export function SecurityManagement({ sessions, currentSessionId, permissions }: Props) {
  const canRevoke = permissions.includes(PERMISSIONS.sessionsRevoke);
  const [state, action, pending] = useActionState(revokeSession, initialState);

  return (
    <div className="space-y-4">
      {state.message && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${state.ok ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-rose-200 bg-rose-50 text-rose-700"}`}>
          {state.message}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-200/30">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-base font-semibold text-slate-950">Sesiones</h2>
          <p className="mt-1 text-xs text-slate-500">
            Cada sesión se identifica por el session_id del JWT. Una sesión revocada pierde acceso a AdminGes aunque su access token todavía no haya expirado.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="bg-slate-50/70 text-[11px] uppercase tracking-wide text-slate-400">
              <tr>
                <th className="px-5 py-3 font-medium">Persona</th>
                <th className="px-5 py-3 font-medium">IP</th>
                <th className="px-5 py-3 font-medium">Inicio</th>
                <th className="px-5 py-3 font-medium">Último uso</th>
                <th className="px-5 py-3 font-medium">Estado</th>
                <th className="px-5 py-3 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((session) => {
                const current = session.id === currentSessionId;
                const revoked = Boolean(session.revoked_at);
                return (
                  <tr key={session.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {session.personas ? `${session.personas.first_name} ${session.personas.last_name}` : session.user_id}
                        {current && <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700">Esta sesión</span>}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400">{session.personas?.email || "Sin correo"}</p>
                    </td>
                    <td className="px-5 py-4 font-mono text-xs text-slate-500">{session.client_ip || "—"}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{formatDate(session.created_at)}</td>
                    <td className="px-5 py-4 text-xs text-slate-600">{formatDate(session.last_seen_at)}</td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${revoked ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                        {revoked ? "Revocada" : "Activa"}
                      </span>
                      {revoked && session.revocation_reason && (
                        <p className="mt-1 max-w-52 text-[11px] text-slate-400">{session.revocation_reason}</p>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {canRevoke && !revoked ? (
                        <form action={action}>
                          <input type="hidden" name="session_id" value={session.id} />
                          <input type="hidden" name="reason" value="Revocada desde el panel de Seguridad" />
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                          >
                            Revocar
                          </button>
                        </form>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {sessions.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-sm text-slate-400">No hay sesiones registradas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}
