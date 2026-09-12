import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ModuleContent } from "@/components/dashboard/module-content";
import { MODULE_PERMISSIONS } from "@/lib/auth/permissions";
import { getAuthorizationContext } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    module?: string;
    view?: string;
    forbidden?: string;
  }>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const context = await getAuthorizationContext();
  if (!context) redirect("/login");

  const params = await searchParams;
  const requestedModule = params.module ?? "resumen";
  const activeModule = Object.hasOwn(MODULE_PERMISSIONS, requestedModule) ? requestedModule : "resumen";
  const requiredPermission = MODULE_PERMISSIONS[activeModule];

  if (requiredPermission && !context.permissions.includes(requiredPermission)) {
    redirect("/dashboard?forbidden=1");
  }

  let users: Array<{
    id: string;
    email: string | null;
    full_name: string | null;
    role: "admin" | "supervisor";
    is_active: boolean;
    created_at: string;
  }> = [];

  let stores: Array<{
    id: string;
    code: string;
    name: string;
    city: string | null;
    address: string | null;
    is_active: boolean;
  }> = [];

  let promoters: Array<{
    id: string;
    store_id: string | null;
    first_name: string;
    last_name: string;
    document: string | null;
    phone: string | null;
    email: string | null;
    is_active: boolean;
    stores: { name: string; code: string } | null;
  }> = [];

  if (["usuarios", "tiendas", "promotores"].includes(activeModule)) {
    const { data } = await context.supabase
      .from("stores")
      .select("id, code, name, city, address, is_active")
      .eq("is_active", true)
      .order("name");
    stores = data ?? [];
  }

  if (activeModule === "usuarios") {
    const { data } = await context.supabase
      .from("profiles")
      .select("id, email, full_name, role, is_active, created_at")
      .order("created_at", { ascending: false });
    users = (data ?? []) as typeof users;
  }

  if (activeModule === "promotores") {
    const { data } = await context.supabase
      .from("promoters")
      .select("id, store_id, first_name, last_name, document, phone, email, is_active, stores(name, code)")
      .order("last_name")
      .order("first_name");
    promoters = (data ?? []) as typeof promoters;
  }

  const permissionSetupMissing = context.permissions.length === 0;
  const notice = params.forbidden
    ? "No tienes permisos para acceder a ese módulo."
    : permissionSetupMissing
      ? "El esquema de permisos aún no está disponible. Ejecuta el SQL 002 antes de habilitar módulos operativos."
      : undefined;

  return (
    <AppShell
      email={context.user.email ?? "usuario@adminges.local"}
      fullName={context.profile.full_name ?? ""}
      role={context.profile.role}
      activeModule={activeModule}
      activeView={params.view}
      permissions={context.permissions}
      notice={notice}
    >
      <ModuleContent
        activeModule={activeModule}
        activeView={params.view}
        permissions={context.permissions}
        users={users}
        stores={stores}
        promoters={promoters}
      />
    </AppShell>
  );
}
