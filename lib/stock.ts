import "server-only";

import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { InsufficientStockError } from "@/lib/errors";
import type { MovementType } from "@/types/movement";

interface AdjustStockContext {
  type: MovementType;
  unitPrice: number;
  recordedBy: string;
}

/**
 * Atomically adjusts a product's stock and records the movement.
 *
 * Mirrors CONTEXT.md Section 3 exactly:
 * - `delta` is positive for a purchase (stock in), negative for a sale (stock out)
 * - runs as a single Firestore transaction so two simultaneous sales can
 *   never both succeed against the last unit
 * - throws InsufficientStockError (and writes nothing) if the resulting
 *   stock would go negative
 * - threshold notifications are fired AFTER the transaction commits, not
 *   inside it, since transactions shouldn't perform side-effect writes to
 *   unrelated documents (the notification target is a different doc tree)
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

    const currentStock = productDoc.data()!.stock as number;
    const productName = productDoc.data()!.name as string;
    const computedStock = currentStock + delta;

    if (computedStock < 0) {
      throw new InsufficientStockError(productId, Math.abs(delta), currentStock);
    }

    tx.update(productRef, { stock: computedStock, updatedAt: Timestamp.now() });

    const movementRef = db.collection("stockMovements").doc();
    tx.set(movementRef, {
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

  // Fired after the transaction commits — see note above.
  const updatedProduct = await db.collection("products").doc(productId).get();
  await checkStockLevel(productId, updatedProduct.data() as { name: string; stock: number; reorderThreshold: number });

  return { newStock };
}

/**
 * Looks up the single business owner's uid. Because this deployment is
 * single-business (CONTEXT.md Section 2), there is exactly one owner to
 * notify — no fan-out to multiple businesses needed.
 */
export async function getBusinessOwnerUid(): Promise<string | null> {
  const snap = await adminDb().collection("users").where("role", "==", "owner").limit(1).get();
  if (snap.empty) return null;
  return snap.docs[0].id;
}

/**
 * Checks the product's stock against its reorder threshold and, if low or
 * out, writes an in-app notification for the owner. Runs as a normal write
 * (not inside the stock transaction) right after adjustStock() commits.
 */
export async function checkStockLevel(
  productId: string,
  product: { name: string; stock: number; reorderThreshold: number }
): Promise<void> {
  const owner = await getBusinessOwnerUid();
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
    type,
    productId,
    message,
    read: false,
    createdAt: Timestamp.now(),
  });
}
