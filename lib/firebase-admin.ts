import "server-only";

/**
 * Firebase ADMIN SDK config — SERVER ONLY. Never import this file from a
 * "use client" component. Used by API routes (/api/sales/checkout,
 * /api/purchases/record, /api/staff/create) that need to run atomic
 * Firestore transactions or create Firebase Auth users, per CONTEXT.md
 * Section 5's note that stock-mutating writes must happen server-side.
 *
 * Initialization is LAZY (only happens the first time getAdminApp() /
 * adminAuth() / adminDb() is actually called) rather than at module
 * import time. This matters because Next.js loads route modules during
 * `next build` to inspect their config — if this file threw immediately
 * on import whenever the env vars are missing (e.g. in CI before secrets
 * are configured), the production build itself would fail before anyone
 * ever handles a request.
 */
import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

let cachedApp: App | null = null;

function getAdminApp(): App {
  if (cachedApp) return cachedApp;
  if (getApps().length) {
    cachedApp = getApps()[0];
    return cachedApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  let privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (privateKey) {
    // Strip accidental surrounding quotes from env var pasting
    privateKey = privateKey.replace(/^["']|["']$/g, "");
    // Private keys are stored in env vars with literal "\n" sequences —
    // they must be converted back to real newlines before use.
    privateKey = privateKey.replace(/\\n/g, "\n");
  }

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "Missing Firebase Admin env vars. Check FIREBASE_ADMIN_PROJECT_ID, " +
        "FIREBASE_ADMIN_CLIENT_EMAIL, and FIREBASE_ADMIN_PRIVATE_KEY in .env.local"
    );
  }

  cachedApp = initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
  return cachedApp;
}

let cachedAuth: Auth | null = null;
let cachedDb: Firestore | null = null;

/** Lazily-initialized Firebase Admin Auth instance. */
export function adminAuth(): Auth {
  if (!cachedAuth) cachedAuth = getAuth(getAdminApp());
  return cachedAuth;
}

/** Lazily-initialized Firebase Admin Firestore instance. */
export function adminDb(): Firestore {
  if (!cachedDb) cachedDb = getFirestore(getAdminApp());
  return cachedDb;
}
