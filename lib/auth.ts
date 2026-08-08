"use client";

import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/types/user";

/**
 * Shared login for both owner and staff. If the account has been
 * deactivated (active: false), sign out immediately with a clear message.
 *
 * NOTE: there is no client-side signup function in this file. Business
 * signup is closed — new businesses (and their owner account) are
 * provisioned by `scripts/create-business.mjs`, run by the platform
 * admin, using the Firebase Admin SDK. See ADMIN.md and
 * AUTHENTICATION.md for why, and for the full provisioning flow.
 */
export async function loginWithEmail(email: string, password: string): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);

  const userSnap = await getDoc(doc(db, "users", credential.user.uid));

  if (!userSnap.exists()) {
    await signOut(auth);
    throw new Error("No account record found. Contact your business owner.");
  }

  const appUser = userSnap.data() as AppUser;

  if (!appUser.active) {
    await signOut(auth);
    throw new Error("This account has been deactivated. Contact your business owner.");
  }

  await syncSessionCookie();
  return appUser;
}

export async function logout(): Promise<void> {
  await signOut(auth);
  clearSessionCookie();
}

/**
 * middleware.ts cannot call the Firebase client SDK (no browser, no
 * onAuthStateChanged) and the Admin SDK doesn't run in the Edge runtime
 * middleware uses by default. So we keep a lightweight, non-sensitive
 * "is someone logged in" cookie in sync with client auth state purely for
 * UX-level route redirects (bounce signed-out visitors away from
 * /dashboard/* to /auth/login). This cookie is NOT treated as a trust
 * boundary anywhere — real authorization is enforced by Firestore
 * Security Rules (client reads/writes, scoped by businessId — see
 * firestore.rules) and by verifying the Firebase ID token server-side
 * with firebase-admin in every API route (writes).
 */
export async function syncSessionCookie(): Promise<void> {
  if (typeof document === "undefined") return;
  document.cookie = `bizstock_session=1; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = "bizstock_session=; path=/; max-age=0; SameSite=Lax";
}
