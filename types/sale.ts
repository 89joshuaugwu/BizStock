import type { Timestamp } from "firebase/firestore";

export interface SaleLineItem {
  productId: string;
  name: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
}

export interface Sale {
  id: string;
  items: SaleLineItem[];
  total: number;
  soldBy: string;
  soldByName: string;
  createdAt: Timestamp | null;
}

export type SaleInput = Omit<Sale, "id" | "createdAt">;

/** Payload sent from the client SalesScreen to POST /api/sales/checkout */
export interface CheckoutRequest {
  items: Array<{ productId: string; qty: number }>;
}

export interface CheckoutSuccessResponse {
  ok: true;
  saleId: string;
  total: number;
}

export interface CheckoutErrorResponse {
  ok: false;
  error: string;
  productId?: string;
  available?: number;
  requested?: number;
}
