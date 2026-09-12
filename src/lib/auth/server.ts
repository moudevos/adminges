import { createClient } from "@/lib/supabase/server";
import type { PermissionKey } from "@/lib/auth/permissions";

export type AppRole = "admin" | "supervisor" | "promotor";

export type AuthorizationContext = {
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
  profile: {
    id: string;
    full_name: string | null;
    email: string | null;
    role: AppRole;
    is_active: boolean;
  };
  permissions: string[];
};

export async function getAuthorizationContext(): Promise<AuthorizationContext | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, is_active")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile || profile.is_active !== true) return null;

  const { data: permissionRows, error: permissionError } = await supabase.rpc("current_permissions");

  const role: AppRole =
    profile.role === "admin"
      ? "admin"
      : profile.role === "promotor"
        ? "promotor"
        : "supervisor";

  return {
    supabase,
    user: {
      id: user.id,
      email: user.email,
      user_metadata: user.user_metadata,
    },
    profile: {
      id: profile.id,
      full_name: profile.full_name,
      email: user.email ?? null,
      role,
      is_active: profile.is_active,
    },
    permissions: permissionError
      ? []
      : (permissionRows ?? []).map((row: { permission_key: string }) => row.permission_key),
  };
}

export function contextHasPermission(context: AuthorizationContext, permission: PermissionKey) {
  return context.permissions.includes(permission);
}
