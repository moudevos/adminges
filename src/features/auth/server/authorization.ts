import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SystemRole = "owner" | "zonal" | "supervisor";
export async function currentAuthorization() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  const { data: profile } = await supabase.from("user_profiles").select("role,is_active").eq("user_id", data.claims.sub).maybeSingle();
  const role = profile?.is_active && ["owner","zonal","supervisor"].includes(profile.role) ? profile.role as SystemRole : null;
  return { supabase, userId: data.claims.sub, role };
}
export async function requireRole(...roles: SystemRole[]) { const auth=await currentAuthorization(); if (!auth.role || !roles.includes(auth.role)) redirect("/inicio"); return auth; }
