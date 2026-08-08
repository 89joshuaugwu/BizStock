import type { Timestamp } from "firebase/firestore";

export interface Product {
  id: string;
  businessId: string;
  name: string;
  sku: string;
  category: string;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  reorderThreshold: number;
  supplier: string;
  imageUrl: string | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export type ProductInput = Omit<Product, "id" | "createdAt" | "updatedAt">;

export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export function getStockStatus(product: Pick<Product, "stock" | "reorderThreshold">): StockStatus {
  if (product.stock <= 0) return "out-of-stock";
  if (product.stock <= product.reorderThreshold) return "low-stock";
  return "in-stock";
}
