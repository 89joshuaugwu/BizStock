import type { Timestamp } from "firebase/firestore";

/** The single business record for this deployment. Exactly one document
 * will ever exist in the /business collection — see CONTEXT.md Section 2. */
export interface Business {
  id: string;
  name: string;
  ownerUid: string;
  defaultReorderThreshold: number;
  createdAt: Timestamp | null;
}

export type BusinessInput = Omit<Business, "id" | "createdAt">;
