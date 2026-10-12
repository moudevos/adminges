"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type LoginActionResult = {
  ok: boolean;
  message?: string;
};

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(6).max(200),
});

export async function loginWithPassword(
  email: string,
  password: string,
): Promise<LoginActionResult> {
  const parsed = loginSchema.safeParse({ email, password });

  if (!parsed.success) {
    return { ok: false, message: "Credenciales inválidas." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email.toLowerCase(),
    password: parsed.data.password,
  });

  if (error) {
    return { ok: false, message: "Correo o contraseña incorrectos." };
  }

  return { ok: true };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
