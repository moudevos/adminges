import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ModuleContent } from "@/components/dashboard/module-content";
import { PersonalManagement } from "@/components/dashboard/personal-management";
import {
  MODULE_PERMISSIONS,
  canAccessModule,
} from "@/lib/auth/permissions";
import { getAuthorizationContext } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    module?: string;
    view?: string;
    forbidden?: string;
  }>;
};

type PersonaRow = {
  id: string;
  user_id: string | null;
  store_id: string | null;
  first_name: string;
  last_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  role: "admin" | "supervisor" | "promotor";
  is_active: boolean;
  stores: { name: string; code: string } | null;
};

type StoreRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  is_active: boolean;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const context = await getAuthorizationContext();
  if (!context) redirect("/login");

  const params = await searchParams;
  const requestedModule = params.module ?? "resumen";
  const activeModule = Object.hasOwn(MODULE_PERMISSIONS, requestedModule)
    ? requestedModule
    : "resumen";

  if (!canAccessModule(context.permissions, activeModule)) {
    redirect("/dashboard?forbidden=1");
  }

  let stores: StoreRow[] = [];
  let personas: PersonaRow[] = [];

  if (["personal", "tiendas"].includes(activeModule)) {
    const { data } = await context.supabase
      .from("stores")
      .select("id, code, name, city, address, is_active")
      .eq("is_active", true)
      .order("name");
    stores = (data ?? []) as StoreRow[];
  }

  if (activeModule === "personal") {
    const { data } = await context.supabase
      .from("personas")
      .select(
        "id, user_id, store_id, first_name, last_name, document, phone, email, role, is_active, stores(name, code)",
      )
      .order("last_name")
      .order("first_name");

    personas = (data ?? []) as PersonaRow[];
  }

  const activeView = activeModule === "personal" ? undefined : params.view;
  const permissionSetupMissing = context.permissions.length === 0;
  const notice = params.forbidden
    ? "No tienes permisos para acceder a ese módulo."
    : permissionSetupMissing
      ? "El esquema de permisos aún no está disponible. Ejecuta los SQL pendientes antes de habilitar módulos operativos."
      : undefined;

  return (
    <AppShell
      email={context.user.email ?? "usuario@adminges.local"}
      fullName={context.profile.full_name ?? ""}
      role={context.profile.role}
      activeModule={activeModule}
      activeView={activeView}
      permissions={context.permissions}
      notice={notice}
    >
      {activeModule === "personal" ? (
        <PersonalManagement
          personas={personas}
          stores={stores}
          permissions={context.permissions}
        />
      ) : (
        <ModuleContent
          activeModule={activeModule}
          activeView={activeView}
          permissions={context.permissions}
          stores={stores}
        />
      )}
    </AppShell>
  );
}