"use client";

import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { Product, ProductInput } from "@/types/product";

const COLLECTION = "products";

/** Live list of all products — used by ProductManagementTable and the
 * Sales screen's product search. Firestore rules permit read to any
 * active authenticated user (owner or staff). */
export function onProductsSnapshot(callback: (products: Product[]) => void): Unsubscribe {
  const q = query(collection(db, COLLECTION), orderBy("name", "asc"));
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Product, "id">) })));
  });
}

export function onProductSnapshot(
  productId: string,
  callback: (product: Product | null) => void
): Unsubscribe {
  return onSnapshot(doc(db, COLLECTION, productId), (snap) => {
    callback(snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Product, "id">) }) : null);
  });
}

export async function getProduct(productId: string): Promise<Product | null> {
  const snap = await getDoc(doc(db, COLLECTION, productId));
  return snap.exists() ? ({ id: snap.id, ...(snap.data() as Omit<Product, "id">) }) : null;
}

/** Owner-only per Firestore rules (write requires role == "owner"). */
export async function createProduct(input: ProductInput): Promise<string> {
  const ref = await addDoc(collection(db, COLLECTION), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateProduct(
  productId: string,
  updates: Partial<ProductInput>
): Promise<void> {
  await updateDoc(doc(db, COLLECTION, productId), {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteProduct(productId: string): Promise<void> {
  await deleteDoc(doc(db, COLLECTION, productId));
}
