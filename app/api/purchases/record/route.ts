import { NextResponse, type NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { adjustStock } from "@/lib/stock";
import { requireUser, requireOwner, ApiAuthError } from "@/lib/api-auth";
import type { RecordPurchaseRequest } from "@/types/purchase";

/**
 * Records a purchase (stock received). OWNER ONLY — staff cannot record
 * purchases, which prevents staff from inflating stock without oversight.
 *
 * TENANT ISOLATION: the target product must belong to the caller's own
 * businessId (read server-side from their verified token) — a
 * cross-tenant productId is treated identically to "not found."
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireOwner(user);

    const body = (await request.json()) as RecordPurchaseRequest;

    if (!body.productId || !Number.isFinite(body.quantity) || body.quantity <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid quantity." }, { status: 400 });
    }
    if (!Number.isFinite(body.costPrice) || body.costPrice < 0) {
      return NextResponse.json({ ok: false, error: "Invalid cost price." }, { status: 400 });
    }
    if (!body.supplier?.trim()) {
      return NextResponse.json({ ok: false, error: "Supplier is required." }, { status: 400 });
    }

    const productSnap = await adminDb().collection("products").doc(body.productId).get();
    if (!productSnap.exists || productSnap.data()?.businessId !== user.businessId) {
      return NextResponse.json({ ok: false, error: "Product not found." }, { status: 404 });
    }

    // Purchases only ever add stock, so there's no insufficient-stock case
    // to guard against here — adjustStock() still runs the same
    // transaction pattern for consistency and race safety, and
    // independently re-verifies the businessId match itself.
    await adjustStock(body.productId, body.quantity, {
      type: "purchase",
      unitPrice: body.costPrice,
      recordedBy: user.uid,
      businessId: user.businessId,
    });

    const totalCost = body.quantity * body.costPrice;
    const purchaseRef = await adminDb().collection("purchases").add({
      businessId: user.businessId,
      productId: body.productId,
      productName: productSnap.data()?.name ?? "",
      quantity: body.quantity,
      costPrice: body.costPrice,
      totalCost,
      supplier: body.supplier.trim(),
      recordedBy: user.uid,
      recordedByName: user.displayName || user.email,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true, purchaseId: purchaseRef.id, totalCost });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[/api/purchases/record]", err);
    return NextResponse.json({ ok: false, error: "Failed to record purchase. Please try again." }, { status: 500 });
  }
}
