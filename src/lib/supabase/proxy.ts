import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth"];

function clientIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

function responseWithSessionCookies(
  response: NextResponse,
  sessionResponse: NextResponse,
) {
  for (const cookie of sessionResponse.cookies.getAll()) {
    response.cookies.set(cookie);
  }

  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = sessionResponse.headers.get(header);
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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));

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

  // getClaims verifica el JWT y refresca access/refresh tokens cuando corresponde.
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const authenticated = !claimsError && Boolean(claimsData?.claims?.sub);

  const pathname = request.nextUrl.pathname;
  const isPublicPath = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!authenticated) {
    if (isPublicPath) return supabaseResponse;

    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return responseWithSessionCookies(NextResponse.redirect(url), supabaseResponse);
  }

  const { data: sessionActive, error: sessionError } = await supabase.rpc(
    "touch_app_session",
    {
      client_ip: clientIp(request),
      client_user_agent: request.headers.get("user-agent") ?? "",
    },
  );

  if (sessionError || sessionActive !== true) {
    await supabase.auth.signOut({ scope: "local" });
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("reason", "session_revoked");
    return responseWithSessionCookies(NextResponse.redirect(url), supabaseResponse);
  }

  if (pathname === "/login") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return responseWithSessionCookies(NextResponse.redirect(url), supabaseResponse);
  }

  return supabaseResponse;
}
