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
import { db } from "@/lib/firebase";
import type { StockMovement } from "@/types/movement";

/** Owner-only per Firestore rules. Live feed of the most recent stock
 * movements (purchases + sales) across all products IN THE CALLER'S OWN
 * BUSINESS, for the dashboard home activity feed. */
export function onRecentMovementsSnapshot(
  businessId: string,
  count: number,
  callback: (movements: StockMovement[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "stockMovements"),
    where("businessId", "==", businessId),
    orderBy("createdAt", "desc"),
    limit(count)
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, "id">) })));
  });
}

/** Owner-only. Full stock movement history for a single product — used
 * on the product detail page. */
export function onProductMovementsSnapshot(
  businessId: string,
  productId: string,
  callback: (movements: StockMovement[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "stockMovements"),
    where("businessId", "==", businessId),
    where("productId", "==", productId),
    orderBy("createdAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<StockMovement, "id">) })));
  });
}
