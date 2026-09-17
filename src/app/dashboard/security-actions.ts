"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { contextHasPermission, getAuthorizationContext } from "@/lib/auth/server";

export type SecurityActionState = {
  ok: boolean;
  message: string;
};

const revokeSchema = z.object({
  session_id: z.string().uuid(),
  reason: z.string().trim().max(200).optional(),
});

export async function revokeSession(
  _previous: SecurityActionState,
  formData: FormData,
): Promise<SecurityActionState> {
  const context = await getAuthorizationContext();
  if (!context) return { ok: false, message: "Sesión inválida." };
  if (!contextHasPermission(context, PERMISSIONS.sessionsRevoke)) {
    return { ok: false, message: "No tienes permiso para revocar sesiones." };
  }

  const parsed = revokeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok: false, message: "Sesión inválida." };

  const { data, error } = await context.supabase.rpc("revoke_app_session", {
    target_session_id: parsed.data.session_id,
    reason: parsed.data.reason || "Revocada desde Seguridad",
  });

  if (error || data !== true) {
    return { ok: false, message: error?.message ?? "No se pudo revocar la sesión." };
  }

  revalidatePath("/dashboard");
  return { ok: true, message: "Sesión revocada. El acceso se bloqueará inmediatamente en AdminGes." };
}
