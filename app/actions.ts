"use server";

import { adminDb } from "@/lib/firebase-admin";

/**
 * Checks if the single business document already exists.
 * Safe to call from unauthenticated Server Components or Client Components.
 */
export async function checkBusinessExists(): Promise<boolean> {
  try {
    const snap = await adminDb().collection("business").doc("main").get();
    return snap.exists;
  } catch (err) {
    console.error("Failed to check if business exists:", err);
    return false;
  }
}
