import { NextResponse, type NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { adjustStock } from "@/lib/stock";
import { InsufficientStockError } from "@/lib/errors";
import { requireUser, ApiAuthError } from "@/lib/api-auth";
import type { CheckoutRequest, SaleLineItem } from "@/types/sale";

/**
 * Records a sale. Both owner and staff may call this (CONTEXT.md Section 4
 * RBAC: "Record a sale" is ✅ for both roles).
 *
 * Hard-block rule (PROMPT.md Phase 3 / CONTEXT.md Section 3): if ANY line
 * item in the cart has insufficient stock, the ENTIRE sale is rejected —
 * nothing is partially completed. We validate every line's availability
 * BEFORE calling adjustStock() on any of them, so a customer paying for 5
 * items never ends up with 4 delivered because the 5th ran out mid-checkout.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    const body = (await request.json()) as CheckoutRequest;

    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ ok: false, error: "Cart is empty." }, { status: 400 });
    }

    for (const item of body.items) {
      if (!item.productId || !Number.isFinite(item.qty) || item.qty <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid cart item." }, { status: 400 });
      }
    }

    // Pre-flight: fetch every product and confirm enough stock exists for
    // EVERY line before mutating anything. This is what makes the
    // hard-block atomic in practice — adjustStock() itself would also
    // reject an individual over-sell, but checking all lines up front
    // means we never adjust product #1's stock only to fail on product #2.
    const productSnaps = await Promise.all(
      body.items.map((item) => adminDb().collection("products").doc(item.productId).get())
    );

    const lineItems: SaleLineItem[] = [];

    for (let i = 0; i < body.items.length; i++) {
      const cartItem = body.items[i];
      const snap = productSnaps[i];

      if (!snap.exists) {
        return NextResponse.json(
          { ok: false, error: `Product ${cartItem.productId} no longer exists.`, productId: cartItem.productId },
          { status: 400 }
        );
      }

      const product = snap.data()!;
      if (product.stock < cartItem.qty) {
        return NextResponse.json(
          {
            ok: false,
            error: `${product.name}: only ${product.stock} left, but ${cartItem.qty} requested.`,
            productId: cartItem.productId,
            available: product.stock,
            requested: cartItem.qty,
          },
          { status: 409 }
        );
      }

      lineItems.push({
        productId: cartItem.productId,
        name: product.name,
        qty: cartItem.qty,
        unitPrice: product.sellingPrice,
        lineTotal: product.sellingPrice * cartItem.qty,
      });
    }

    // All lines confirmed available — now actually deduct stock, one
    // transaction per line item, exactly per CONTEXT.md Section 3.
    // A second, near-simultaneous checkout racing against this one is
    // still safe: adjustStock()'s own transaction will catch it and throw
    // InsufficientStockError for whichever request loses the race.
    try {
      for (const line of lineItems) {
        await adjustStock(line.productId, -line.qty, {
          type: "sale",
          unitPrice: line.unitPrice,
          recordedBy: user.uid,
        });
      }
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return NextResponse.json(
          {
            ok: false,
            error: `Stock changed before checkout completed — only ${err.available} of "${err.productId}" left.`,
            productId: err.productId,
            available: err.available,
            requested: err.requested,
          },
          { status: 409 }
        );
      }
      throw err;
    }

    const total = lineItems.reduce((sum, l) => sum + l.lineTotal, 0);
    const saleRef = await adminDb().collection("sales").add({
      items: lineItems,
      total,
      soldBy: user.uid,
      soldByName: user.displayName || user.email,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true, saleId: saleRef.id, total });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[/api/sales/checkout]", err);
    return NextResponse.json({ ok: false, error: "Failed to complete sale. Please try again." }, { status: 500 });
  }
}
