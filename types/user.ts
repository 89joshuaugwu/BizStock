import type { Timestamp } from "firebase/firestore";

export type UserRole = "owner" | "staff";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  /** Which business this account belongs to. Set once at account
   * creation (by the provisioning script for owners, by /api/staff/create
   * for staff) and never changed — an account belongs to exactly one
   * business for the lifetime of that account. */
  businessId: string;
  createdAt: Timestamp | null;
}

export type AppUserInput = Omit<AppUser, "createdAt">;
