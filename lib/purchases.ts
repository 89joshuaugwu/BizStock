"use client";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "@/lib/firebase";
import type { Purchase, RecordPurchaseRequest } from "@/types/purchase";

/** Owner-only per Firestore rules, scoped to the caller's own business. */
export function onPurchasesSnapshot(
  businessId: string,
  count: number,
  callback: (purchases: Purchase[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "purchases"),
    where("businessId", "==", businessId),
    orderBy("createdAt", "desc"),
    limit(count)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Purchase, "id">) })));
  });
}

/** Calls the server route — same reasoning as checkoutSale(): stock must
 * update in the same transaction as the purchase/movement record, and
 * businessId is derived server-side from the caller's own session. */
export async function recordPurchase(request: RecordPurchaseRequest): Promise<{ purchaseId: string }> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("You must be logged in to record a purchase.");

  const res = await fetch("/api/purchases/record", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(request),
  });

  const data = await res.json();

  if (!res.ok || !data.ok) {
    throw new Error(data.error ?? "Failed to record purchase.");
  }

  return { purchaseId: data.purchaseId };
}
