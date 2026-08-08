"use client";

import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { AppUser } from "@/types/user";

export function onUserSnapshot(
  uid: string,
  callback: (user: AppUser | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, "users", uid), (snap) => {
    callback(snap.exists() ? (snap.data() as AppUser) : null);
  });
}

/** Owner-only: live list of all users (owner + staff) IN THE CALLER'S
 * OWN BUSINESS, for the Staff page. */
export function onAllUsersSnapshot(
  businessId: string,
  callback: (users: AppUser[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "users"),
    where("businessId", "==", businessId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => d.data() as AppUser));
  });
}

/** Owner-only per Firestore rules (users/{uid} update requires role ==
 * "owner" within the same business). Deactivating never deletes the
 * account or any historical sales tied to that uid. */
export async function setUserActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, "users", uid), { active });
}
