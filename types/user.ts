import type { Timestamp } from "firebase/firestore";

export type UserRole = "owner" | "admin" | "staff";

export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  active: boolean;
  createdAt: Timestamp | null;
}

export type AppUserInput = Omit<AppUser, "createdAt">;
