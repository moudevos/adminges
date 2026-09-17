import { redirect } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { ModuleContent } from "@/components/dashboard/module-content";
import { PersonalManagement } from "@/components/dashboard/personal-management";
import { SecurityManagement } from "@/components/dashboard/security-management";
import { TerritoryManagement } from "@/components/dashboard/territory-management";
import { MODULE_PERMISSIONS, canAccessModule } from "@/lib/auth/permissions";
import { getAuthorizationContext } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

type DashboardPageProps = {
  searchParams: Promise<{
    module?: string;
    view?: string;
    forbidden?: string;
  }>;
};

type Role = "admin" | "zonal" | "supervisor" | "promotor";

type PersonaRow = {
  id: string;
  user_id: string | null;
  puesto_id: string;
  first_name: string;
  last_name: string;
  document: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
  is_active: boolean;
  puestos: { code: string; name: string } | null;
  persona_zones?: Array<{
    zone_id: string;
    is_active: boolean;
    zones: { code: string; name: string } | null;
  }>;
  persona_clusters?: Array<{
    cluster_id: string;
    is_active: boolean;
    clusters: { code: string; name: string } | null;
  }>;
  persona_stores?: Array<{
    store_id: string;
    is_active: boolean;
    stores: { code: string; name: string } | null;
  }>;
};

type PuestoRow = { id: string; code: string; name: string };
type ZoneRow = { id: string; code: string; name: string; is_active: boolean };
type ClusterRow = { id: string; zone_id: string; code: string; name: string; is_active: boolean };

type StoreRow = {
  id: string;
  code: string;
  name: string;
  city: string | null;
  address: string | null;
  zone_id: string | null;
  cluster_id: string | null;
  is_active: boolean;
  zones: { code: string; name: string } | null;
  clusters: { code: string; name: string } | null;
};

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
  personas: { first_name: string; last_name: string; email: string | null } | null;
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

  let personas: PersonaRow[] = [];
  let puestos: PuestoRow[] = [];
  let zones: ZoneRow[] = [];
  let clusters: ClusterRow[] = [];
  let stores: StoreRow[] = [];
  let sessions: SessionRow[] = [];
  let currentSessionId: string | undefined;

  if (["personal", "tiendas", "territorio"].includes(activeModule)) {
    const { data } = await context.supabase
      .from("stores")
      .select(
        "id, code, name, city, address, zone_id, cluster_id, is_active, zones(code, name), clusters(code, name)",
      )
      .eq("is_active", true)
      .order("name");
    stores = (data ?? []) as StoreRow[];
  }

  if (["personal", "territorio"].includes(activeModule)) {
    const [{ data: zoneData }, { data: clusterData }] = await Promise.all([
      context.supabase
        .from("zones")
        .select("id, code, name, is_active")
        .eq("is_active", true)
        .order("name"),
      context.supabase
        .from("clusters")
        .select("id, zone_id, code, name, is_active")
        .eq("is_active", true)
        .order("name"),
    ]);

    zones = (zoneData ?? []) as ZoneRow[];
    clusters = (clusterData ?? []) as ClusterRow[];
  }

  if (activeModule === "personal") {
    const [{ data: puestoData }, { data: personaData }] = await Promise.all([
      context.supabase
        .from("puestos")
        .select("id, code, name")
        .eq("is_active", true)
        .order("name"),
      context.supabase
        .from("personas")
        .select(
          "id, user_id, puesto_id, first_name, last_name, document, phone, email, role, is_active, puestos(code, name), persona_zones(zone_id, is_active, zones(code, name)), persona_clusters(cluster_id, is_active, clusters(code, name)), persona_stores(store_id, is_active, stores(code, name))",
        )
        .order("last_name")
        .order("first_name"),
    ]);

    puestos = (puestoData ?? []) as PuestoRow[];
    personas = (personaData ?? []) as PersonaRow[];
  }

  if (activeModule === "seguridad") {
    const [{ data: sessionData }, { data: claimsData }] = await Promise.all([
      context.supabase
        .from("app_sessions")
        .select(
          "id, user_id, persona_id, client_ip, user_agent, created_at, last_seen_at, revoked_at, revocation_reason, personas(first_name, last_name, email)",
        )
        .order("last_seen_at", { ascending: false })
        .limit(200),
      context.supabase.auth.getClaims(),
    ]);

    sessions = (sessionData ?? []) as SessionRow[];
    const claimSessionId = claimsData?.claims?.session_id;
    currentSessionId = typeof claimSessionId === "string" ? claimSessionId : undefined;
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
          actorRole={context.profile.role}
          personas={personas}
          stores={stores}
          puestos={puestos}
          zones={zones}
          clusters={clusters}
          permissions={context.permissions}
        />
      ) : activeModule === "territorio" ? (
        <TerritoryManagement
          zones={zones}
          clusters={clusters}
          stores={stores}
          permissions={context.permissions}
        />
      ) : activeModule === "seguridad" ? (
        <SecurityManagement
          sessions={sessions}
          currentSessionId={currentSessionId}
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
