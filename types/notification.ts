import type { Timestamp } from "firebase/firestore";

export type NotificationType = "low_stock" | "out_of_stock";

export interface AppNotification {
  id: string;
  type: NotificationType;
  productId: string;
  message: string;
  read: boolean;
  createdAt: Timestamp | null;
}
