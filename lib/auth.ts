"use client";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import type { AppUser } from "@/types/user";

/** Fixed document ID for the single business record this deployment
 * serves — see CONTEXT.md Section 2 (single-business scope, no
 * multi-tenant selector). */
export const BUSINESS_DOC_ID = "main";

export interface SignUpOwnerInput {
  businessName: string;
  ownerName: string;
  email: string;
  password: string;
}

/**
 * Owner self-service signup — DESIGN.md "Signup" section.
 *
 * Order matters here: the /users/{uid} doc must be created BEFORE the
 * /business/{businessId} doc. The Firestore rule for /business writes
 * calls getRole(), which reads /users/{uid} — if that doc doesn't exist
 * yet, the business write is denied. These cannot be batched atomically
 * for the same reason (security rules evaluate a batch against
 * pre-batch state), so they run as two sequential writes.
 */
export async function signUpOwner(input: SignUpOwnerInput): Promise<void> {
  const { businessName, ownerName, email, password } = input;

  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const uid = credential.user.uid;

  await updateProfile(credential.user, { displayName: ownerName });

  await setDoc(doc(db, "users", uid), {
    uid,
    email,
    displayName: ownerName,
    role: "owner",
    active: true,
    createdAt: serverTimestamp(),
  });

  await setDoc(doc(db, "business", BUSINESS_DOC_ID), {
    name: businessName,
    ownerUid: uid,
    defaultReorderThreshold: 10,
    createdAt: serverTimestamp(),
  });

  await syncSessionCookie();
}

/**
 * Shared login for both owner and staff. If the account has been
 * deactivated (active: false), sign out immediately with a clear message
 * — same pattern as PharmaLedger's attendant login guard.
 */
export async function loginWithEmail(email: string, password: string): Promise<AppUser> {
  const credential = await signInWithEmailAndPassword(auth, email, password);

  const { getDoc, doc: docRef } = await import("firebase/firestore");
  const userSnap = await getDoc(docRef(db, "users", credential.user.uid));

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
 * Security Rules (client reads/writes) and by verifying the Firebase ID
 * token server-side with firebase-admin in every API route (writes).
 */
export async function syncSessionCookie(): Promise<void> {
  if (typeof document === "undefined") return;
  document.cookie = `bizstock_session=1; path=/; max-age=${60 * 60 * 24 * 14}; SameSite=Lax`;
}

export function clearSessionCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = "bizstock_session=; path=/; max-age=0; SameSite=Lax";
}
