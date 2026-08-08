import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { InsufficientStockError } from "@/lib/errors";
import type { MovementType } from "@/types/movement";

interface AdjustStockContext {
  type: MovementType;
  unitPrice: number;
  recordedBy: string;
  /** The CALLING USER's own businessId, verified server-side (see
   * lib/api-auth.ts). This must match the product's actual businessId or
   * the whole operation is rejected — see the note below on why this
   * check lives here and not just in the API route. */
  businessId: string;
}

/**
 * Atomically adjusts a product's stock and records the movement.
 *
 * - `delta` is positive for a purchase (stock in), negative for a sale (stock out)
 * - runs as a single Firestore transaction so two simultaneous sales can
 *   never both succeed against the last unit
 * - throws InsufficientStockError (and writes nothing) if the resulting
 *   stock would go negative
 * - threshold notifications are fired AFTER the transaction commits, not
 *   inside it, since transactions shouldn't perform side-effect writes to
 *   unrelated documents (the notification target is a different doc tree)
 *
 * TENANT ISOLATION: this function (and everything in app/api/*) runs
 * with the Firebase ADMIN SDK, which bypasses Firestore Security Rules
 * entirely — rules are not a safety net here. So adjustStock() itself
 * re-verifies that the product actually belongs to context.businessId
 * INSIDE the transaction, before touching anything. Without this check,
 * a bug (or a malicious request) that got a cross-tenant productId this
 * far would let one business silently deduct or inflate a competitor's
 * stock. The API routes also pre-check this before calling adjustStock()
 * — this is a second, independent check, not a redundant one, since it's
 * the last line of defense right at the point of mutation.
 */
export async function adjustStock(
  productId: string,
  delta: number,
  context: AdjustStockContext
): Promise<{ newStock: number }> {
  const db = adminDb();
  const newStock = await db.runTransaction(async (tx) => {
    const productRef = db.collection("products").doc(productId);
    const productDoc = await tx.get(productRef);

    if (!productDoc.exists) {
      throw new Error(`Product ${productId} does not exist.`);
    }

    const data = productDoc.data()!;

    if (data.businessId !== context.businessId) {
      // Deliberately vague — same message a "doesn't exist" case would
      // give, so a cross-tenant probing attempt learns nothing.
      throw new Error(`Product ${productId} does not exist.`);
    }

    const currentStock = data.stock as number;
    const productName = data.name as string;
    const computedStock = currentStock + delta;

    if (computedStock < 0) {
      throw new InsufficientStockError(productId, Math.abs(delta), currentStock);
    }

    tx.update(productRef, { stock: computedStock, updatedAt: Timestamp.now() });

    const movementRef = db.collection("stockMovements").doc();
    tx.set(movementRef, {
      businessId: context.businessId,
      productId,
      productName,
      type: context.type,
      quantity: Math.abs(delta),
      unitPrice: context.unitPrice,
      totalValue: Math.abs(delta) * context.unitPrice,
      recordedBy: context.recordedBy,
      createdAt: Timestamp.now(),
    });

    return computedStock;
  });

  // Fired after the transaction commits — see note in the doc comment above.
  const updatedProduct = await db.collection("products").doc(productId).get();
  await checkStockLevel(
    context.businessId,
    productId,
    updatedProduct.data() as { name: string; stock: number; reorderThreshold: number }
  );

  return { newStock };
}

/**
 * Looks up the owner's uid FOR A SPECIFIC BUSINESS. Multi-tenant: there
 * can be many owners across many businesses, so this always filters by
 * businessId first — never a bare "find any owner" query.
 */
export async function getBusinessOwnerUid(businessId: string): Promise<string | null> {
  const snap = await adminDb()
    .collection("users")
    .where("businessId", "==", businessId)
    .where("role", "==", "owner")
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Checks the product's stock against its reorder threshold and, if low or
 * out, writes an in-app notification for that business's owner. Runs as
 * a normal write (not inside the stock transaction) right after
 * adjustStock() commits.
 */
export async function checkStockLevel(
  businessId: string,
  productId: string,
  product: { name: string; stock: number; reorderThreshold: number }
): Promise<void> {
  const owner = await getBusinessOwnerUid(businessId);
  if (!owner) return;

  let type: "low_stock" | "out_of_stock" | null = null;
  let message = "";

  if (product.stock === 0) {
    type = "out_of_stock";
    message = `${product.name} is now out of stock.`;
  } else if (product.stock <= product.reorderThreshold) {
    type = "low_stock";
    message = `${product.name} is low: ${product.stock} units left.`;
  }

  if (!type) return;

  await adminDb().collection("notifications").doc(owner).collection("items").add({
    businessId,
    type,
    productId,
    message,
    read: false,
    createdAt: Timestamp.now(),
  });
}
