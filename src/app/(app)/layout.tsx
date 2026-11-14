import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ProtectedAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  const email =
    typeof data.claims.email === "string" ? data.claims.email : "usuario";

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role, is_active, personas(nombres, apellidos)")
    .eq("user_id", data.claims.sub)
    .maybeSingle();

  const person = Array.isArray(profile?.personas)
    ? profile.personas[0]
    : profile?.personas;
  const name = profile?.is_active && person
    ? [person.nombres, person.apellidos].filter(Boolean).join(" ")
    : "Usuario";
  const role = profile?.is_active && ["owner", "zonal", "supervisor"].includes(profile.role)
    ? profile.role
    : null;

  if (!role) redirect("/login?next=/inicio");
  return <AppShell email={email} name={name} role={role}>{children}</AppShell>;
}
