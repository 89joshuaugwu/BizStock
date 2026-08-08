import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { PLATFORM_CONTACT } from "@/lib/config";
import type { PlatformConfig } from "@/types/platformConfig";

const DOC_PATH = ["platformConfig", "main"] as const;

/**
 * Reads platform config (currently just the WhatsApp contact) directly
 * with the Admin SDK — used by Server Components (landing page, public
 * layout) and by the public config API route the login page's client
 * component calls. Deliberately does NOT go through the client Firestore
 * SDK at all, so no public Firestore Security Rule is needed for this
 * collection (see the deny-all rule for /platformConfig in
 * firestore.rules — defense in depth, not load-bearing for this read
 * path, but closes the door on anyone trying a direct client read).
 *
 * Falls back to the static defaults in lib/config.ts if the doc doesn't
 * exist yet (e.g. a fresh deployment before the admin has opened
 * /admin and saved anything).
 */
export async function getPlatformConfigServer(): Promise<PlatformConfig> {
  try {
    const snap = await adminDb().collection(DOC_PATH[0]).doc(DOC_PATH[1]).get();
    if (!snap.exists) return { ...PLATFORM_CONTACT };
    const data = snap.data() as Partial<PlatformConfig>;
    return {
      whatsappNumber: data.whatsappNumber || PLATFORM_CONTACT.whatsappNumber,
      whatsappMessage: data.whatsappMessage || PLATFORM_CONTACT.whatsappMessage,
    };
  } catch {
    // If Firebase Admin isn't configured yet (e.g. local dev without
    // .env.local filled in) fall back rather than crashing the landing
    // page entirely.
    return { ...PLATFORM_CONTACT };
  }
}

export async function updatePlatformConfigServer(updates: Partial<PlatformConfig>): Promise<void> {
  await adminDb().collection(DOC_PATH[0]).doc(DOC_PATH[1]).set(updates, { merge: true });
}
