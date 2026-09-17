"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type LoginActionResult = {
  ok: boolean;
  message?: string;
};

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(200),
});

function getClientIp(requestHeaders: Headers) {
  const forwarded = requestHeaders.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return requestHeaders.get("x-real-ip")?.trim() || "unknown";
}

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse({ email, password });
  if (!parsed.success) {
    return { ok: false, message: "Credenciales inválidas." };
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const requestHeaders = await headers();
  const clientIp = getClientIp(requestHeaders);
  const userAgent = requestHeaders.get("user-agent") ?? "";
  const admin = createAdminClient();

  const { data: rateRows, error: rateError } = await admin.rpc("check_login_rate_limit", {
    login_email: normalizedEmail,
    client_ip: clientIp,
  });

  if (rateError) {
    console.error("login rate limit check failed", rateError);
    return { ok: false, message: "No se pudo validar el acceso. Intenta nuevamente." };
  }

  const rate = Array.isArray(rateRows) ? rateRows[0] : rateRows;
  if (rate && rate.allowed === false) {
    const seconds = Number(rate.retry_after_seconds ?? 60);
    const minutes = Math.max(1, Math.ceil(seconds / 60));
    return {
      ok: false,
      message: `Demasiados intentos. Intenta nuevamente en ${minutes} min.`,
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizedEmail,
    password: parsed.data.password,
  });

  await admin.rpc("record_login_attempt", {
    login_email: normalizedEmail,
    client_ip: clientIp,
    was_success: !error,
  });

  if (error || !data.user) {
    return {
      ok: false,
      message: "Credenciales inválidas o acceso temporalmente bloqueado.",
    };
  }

  const { data: profile } = await admin
    .from("profiles")
    .select("is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (!profile?.is_active) {
    await supabase.auth.signOut({ scope: "local" });
    return { ok: false, message: "Credenciales inválidas o acceso no disponible." };
  }

  const { data: sessionActive, error: sessionError } = await supabase.rpc("touch_app_session", {
    client_ip: clientIp,
    client_user_agent: userAgent,
  });

  if (sessionError || sessionActive !== true) {
    await supabase.auth.signOut({ scope: "local" });
    console.error("app session registration failed", sessionError);
    return { ok: false, message: "No se pudo iniciar una sesión segura." };
  }

  return { ok: true };
}
