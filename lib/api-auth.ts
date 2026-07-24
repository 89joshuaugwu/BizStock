import "server-only";

import type { NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import type { AppUser } from "@/types/user";

export class ApiAuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
  }
}

/**
 * Verifies the Bearer ID token on an incoming API request and loads the
 * caller's /users/{uid} doc. Every server route that mutates data
 * (checkout, purchase, staff creation) calls this first — this is the
 * real authorization boundary for writes, since Firestore Security Rules
 * alone can't protect the atomic transactions in lib/stock.ts (those run
 * with the Admin SDK, which bypasses rules by design).
 */
export async function requireUser(request: NextRequest): Promise<AppUser & { uid: string }> {
  const authHeader = request.headers.get("authorization") ?? request.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    throw new ApiAuthError("Missing Authorization header.", 401);
  }

  let decoded;
  try {
    decoded = await adminAuth().verifyIdToken(idToken);
  } catch {
    throw new ApiAuthError("Invalid or expired session. Please log in again.", 401);
  }

  const userDoc = await adminDb().collection("users").doc(decoded.uid).get();
  if (!userDoc.exists) {
    throw new ApiAuthError("No account record found.", 403);
  }

  const appUser = userDoc.data() as AppUser;
  if (!appUser.active) {
    throw new ApiAuthError("This account has been deactivated.", 403);
  }

  return { ...appUser, uid: decoded.uid };
}

export function requireOwner(user: AppUser): void {
  if (user.role !== "owner") {
    throw new ApiAuthError("This action is only available to the business owner.", 403);
  }
}
