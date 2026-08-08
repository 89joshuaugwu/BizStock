import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight, UX-level route guard. (Renamed from middleware.ts to
 * proxy.ts per the Next.js 16 convention — see
 * https://nextjs.org/docs/messages/middleware-to-proxy — this is a pure
 * rename, the logic is unchanged.)
 *
 * This checks only for the presence of the `bizstock_session` cookie set
 * by lib/auth.ts on successful client-side login — it does NOT verify a
 * Firebase ID token (the Admin SDK doesn't run in the Proxy runtime
 * either, and doing a network round-trip per request here isn't worth it
 * for a low-cost multi-tenant app on the Spark plan). Real authorization
 * happens in two places:
 *
 *   1. Firestore Security Rules — every read/write the client makes is
 *      checked server-side against auth.uid + the caller's role/active
 *      status AND businessId (see firestore.rules).
 *   2. API routes (/api/sales/checkout, /api/purchases/record,
 *      /api/staff/create) — each verifies the caller's Firebase ID token
 *      with firebase-admin, and re-derives businessId server-side,
 *      before doing anything.
 *
 * This proxy just keeps signed-out visitors from seeing a flash of
 * dashboard UI before the client-side redirect would otherwise kick in.
 */
export function proxy(request: NextRequest) {
  const isDashboardRoute = request.nextUrl.pathname.startsWith("/dashboard");
  if (!isDashboardRoute) return NextResponse.next();

  const hasSession = request.cookies.has("bizstock_session");
  if (!hasSession) {
    const loginUrl = new URL("/auth/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
