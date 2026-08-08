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
import type { CheckoutRequest, CheckoutErrorResponse, CheckoutSuccessResponse, Sale } from "@/types/sale";

/** Readable by both owner and staff per Firestore rules, scoped to the
 * caller's own business. */
export function onSalesSnapshot(
  businessId: string,
  count: number,
  callback: (sales: Sale[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "sales"),
    where("businessId", "==", businessId),
    orderBy("createdAt", "desc"),
    limit(count)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Sale, "id">) })));
  });
}

/** Calls the server route — sales are never written directly from the
 * client, since the stock deduction must happen in the same transaction
 * as the sale record. The server derives businessId from the caller's
 * own verified session, never from this request body — see
 * app/api/sales/checkout/route.ts. */
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
