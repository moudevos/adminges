import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_APP_HREF } from "@/config/navigation";

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

  if (authenticated && isLogin) {
    const url = request.nextUrl.clone();
    url.pathname = DEFAULT_APP_HREF;
    url.search = "";

    return copySessionState(
      NextResponse.redirect(url),
      supabaseResponse,
    );
  }

  return supabaseResponse;
}
