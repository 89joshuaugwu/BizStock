import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ADMIN_SESSION_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";

/**
 * Unlike app/(dashboard)/layout.tsx (which only checks cookie PRESENCE
 * client-side, since real auth there depends on the Firebase client SDK
 * — see AUTHENTICATION.md §6), this check is a REAL, cryptographic
 * verification, done entirely server-side, before any admin page ever
 * renders. That's possible here because admin auth is a self-contained
 * signed token (lib/admin-auth.ts) that doesn't depend on any external
 * service — see the comment at the top of that file for why admin auth
 * is deliberately kept separate from the owner/staff Firebase Auth model.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value;

  if (!verifyAdminSessionToken(token)) {
    redirect("/admin/login");
  }

  return <div className="min-h-screen bg-bg">{children}</div>;
}
