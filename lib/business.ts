"use client";

import { doc, onSnapshot, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Business } from "@/types/business";

export function businessRef(businessId: string) {
  return doc(db, "business", businessId);
}

export function onBusinessSnapshot(
  businessId: string,
  callback: (business: Business | null) => void
): Unsubscribe {
  return onSnapshot(businessRef(businessId), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Omit<Business, "id">) });
  });
}

/** Owner-only per Firestore rules. Covers both business settings (name,
 * default reorder threshold) and branding (logoUrl, brandColor) — see
 * the Settings page. */
export async function updateBusiness(
  businessId: string,
  updates: Partial<Pick<Business, "name" | "defaultReorderThreshold" | "logoUrl" | "brandColor">>
): Promise<void> {
  await updateDoc(businessRef(businessId), updates);
}
