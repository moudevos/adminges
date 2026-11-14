import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function copySessionState(response: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(header);
    if (value) response.headers.set(header, value);
  }

  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );

          supabaseResponse = NextResponse.next({ request });

          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );

          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  const authenticated = !error && Boolean(data?.claims?.sub);
  const pathname = request.nextUrl.pathname;
  const isLogin = pathname === "/login";

  if (!authenticated && !isLogin) {
    const url = request.nextUrl.clone();
    const nextPath = pathname + request.nextUrl.search;

    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", nextPath);

    return copySessionState(
      NextResponse.redirect(url),
      supabaseResponse,
    );
  }

  // A valid session can exist before its user profile is provisioned. Redirecting
  // that session from /login to /inicio created an endless 307 redirect loop.
  if (authenticated && !isLogin) {
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("role,is_active")
      .eq("user_id", data?.claims?.sub ?? "")
      .maybeSingle();
    const ownerPaths = ["/administracion", "/personal", "/configuraciones/usuarios", "/configuraciones/puestos", "/configuraciones/zonas", "/configuraciones/tiendas"];
    const isOwnerPath = ownerPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
    if (profile?.is_active && profile.role === "owner" && !isOwnerPath) {
      const url = request.nextUrl.clone();
      url.pathname = "/administracion";
      url.search = "";
      return copySessionState(NextResponse.redirect(url), supabaseResponse);
    }
  }

  return supabaseResponse;
}
