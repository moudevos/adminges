import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const allowedModules = new Set([
  "resumen",
  "tiendas",
  "inventario",
  "ventas",
  "promotores",
  "horarios",
  "cuotas",
  "analisis",
]);

type DashboardPageProps = {
  searchParams: Promise<{
    module?: string;
    view?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const params = await searchParams;
  const requestedModule = params.module ?? "resumen";
  const activeModule = allowedModules.has(requestedModule) ? requestedModule : "resumen";

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  return (
    <AppShell
      email={user.email ?? "usuario@adminges.local"}
      fullName={profile?.full_name ?? (user.user_metadata?.full_name as string | undefined) ?? ""}
      role={profile?.role === "admin" ? "admin" : "supervisor"}
      activeModule={activeModule}
      activeView={params.view}
    />
  );
}
