"use client";

import { doc, onSnapshot, updateDoc, type Unsubscribe } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { BUSINESS_DOC_ID } from "@/lib/auth";
import type { Business } from "@/types/business";

export function businessRef() {
  return doc(db, "business", BUSINESS_DOC_ID);
}

export function onBusinessSnapshot(callback: (business: Business | null) => void): Unsubscribe {
  return onSnapshot(businessRef(), (snap) => {
    if (!snap.exists()) {
      callback(null);
      return;
    }
    callback({ id: snap.id, ...(snap.data() as Omit<Business, "id">) });
  });
}

export async function updateBusiness(
  updates: Partial<Pick<Business, "name" | "defaultReorderThreshold">>
): Promise<void> {
  await updateDoc(businessRef(), updates);
}
