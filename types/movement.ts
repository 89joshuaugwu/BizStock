import type { Timestamp } from "firebase/firestore";

export type MovementType = "purchase" | "sale";

export interface StockMovement {
  id: string;
  businessId: string;
  productId: string;
  productName?: string;
  type: MovementType;
  quantity: number;
  unitPrice: number;
  totalValue: number;
  recordedBy: string;
  createdAt: Timestamp | null;
}

export type StockMovementInput = Omit<StockMovement, "id" | "createdAt" | "productName">;
