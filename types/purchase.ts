import type { Timestamp } from "firebase/firestore";

export interface Purchase {
  id: string;
  productId: string;
  productName?: string;
  quantity: number;
  costPrice: number;
  totalCost: number;
  supplier: string;
  recordedBy: string;
  recordedByName: string;
  createdAt: Timestamp | null;
}

export type PurchaseInput = Omit<Purchase, "id" | "createdAt" | "productName">;

/** Payload sent from PurchaseForm to POST /api/purchases/record */
export interface RecordPurchaseRequest {
  productId: string;
  quantity: number;
  costPrice: number;
  supplier: string;
}
