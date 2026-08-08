import type { Timestamp } from "firebase/firestore";

/**
 * One document per client business — multi-tenant. Businesses are
 * provisioned by the platform admin (scripts/create-business.mjs), not
 * through public self-signup — see ADMIN.md.
 */
export interface Business {
  id: string;
  name: string;
  ownerUid: string;
  defaultReorderThreshold: number;
  /** Owner-editable in Settings. Falls back to the default BizStock mark
   * (components/ui/Logo.tsx) when null. */
  logoUrl: string | null;
  /** Owner-editable in Settings. Hex color, e.g. "#7C3AED". Falls back to
   * the default Violet brand color when null. */
  brandColor: string | null;
  createdAt: Timestamp | null;
}

export type BusinessInput = Omit<Business, "id" | "createdAt">;
