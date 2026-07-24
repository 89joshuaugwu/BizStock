/** Thrown by adjustStock() when a sale would take a product's stock below
 * zero. Carries enough detail for the API route to return a clear,
 * actionable error naming which item and how much is actually available —
 * per CONTEXT.md Section 3 / PROMPT.md Phase 3. */
export class InsufficientStockError extends Error {
  productId: string;
  requested: number;
  available: number;

  constructor(productId: string, requested: number, available: number) {
    super(
      `Insufficient stock for product ${productId}: requested ${requested}, only ${available} available.`
    );
    this.name = "InsufficientStockError";
    this.productId = productId;
    this.requested = requested;
    this.available = available;
  }
}
