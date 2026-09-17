"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.rpc("revoke_current_app_session", { reason: "Cierre de sesión" });
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
