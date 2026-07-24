"use client";

import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { CheckoutRequest, CheckoutErrorResponse, CheckoutSuccessResponse, Sale } from "@/types/sale";
import { auth } from "@/lib/firebase";

/** Readable by both owner and staff per Firestore rules. */
export function onSalesSnapshot(count: number, callback: (sales: Sale[]) => void): Unsubscribe {
  const q = query(collection(db, "sales"), orderBy("createdAt", "desc"), limit(count));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) })));
  });
}

/** Calls the server route — sales are never written directly from the
 * client, since the stock deduction must happen in the same transaction
 * as the sale record (CONTEXT.md Section 5's note on stockMovements). */
export async function checkoutSale(
  request: CheckoutRequest
): Promise<CheckoutSuccessResponse> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error("You must be logged in to record a sale.");

  const res = await fetch("/api/sales/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(request),
  });

  const data = (await res.json()) as CheckoutSuccessResponse | CheckoutErrorResponse;

  if (!res.ok || !data.ok) {
    throw new Error((data as CheckoutErrorResponse).error ?? "Checkout failed.");
  }

  return data;
}
