import "server-only";

import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { Timestamp, type Firestore, type Query } from "firebase-admin/firestore";
import type { Business } from "@/types/business";

function randomPassword(): string {
  return Math.random().toString(36).slice(-6) + Math.floor(Math.random() * 10);
}

export interface BusinessListItem extends Business {
  ownerEmail: string;
  ownerName: string;
  ownerActive: boolean;
  staffCount: number;
}

/** Joins each /business doc with its owner's email/active status and a
 * staff headcount. N+1 queries, deliberately — this is a low-traffic
 * internal admin tool used by one person, not a hot path, and it keeps
 * the query shape simple. */
export async function listBusinessesAdmin(): Promise<BusinessListItem[]> {
  const db = adminDb();
  const businessSnap = await db.collection("business").orderBy("createdAt", "desc").get();

  const results = await Promise.all(
    businessSnap.docs.map(async (doc) => {
      const business = { id: doc.id, ...(doc.data() as Omit<Business, "id">) };

      const [ownerSnap, staffSnap] = await Promise.all([
        db.collection("users").doc(business.ownerUid).get(),
        db.collection("users").where("businessId", "==", business.id).where("role", "==", "staff").count().get(),
      ]);

      const ownerData = ownerSnap.data();

      return {
        ...business,
        ownerEmail: ownerData?.email ?? "(owner account missing)",
        ownerName: ownerData?.displayName ?? "",
        ownerActive: ownerData?.active ?? false,
        staffCount: staffSnap.data().count,
      } satisfies BusinessListItem;
    })
  );

  return results;
}

export interface CreateBusinessAdminInput {
  businessName: string;
  ownerName: string;
  ownerEmail: string;
  defaultReorderThreshold?: number;
  logoUrl?: string | null;
  brandColor?: string | null;
}

export interface CreateBusinessAdminResult {
  businessId: string;
  ownerUid: string;
  tempPassword: string;
}

/**
 * Same operation as scripts/create-business.mjs, reimplemented here in
 * TypeScript so the admin panel doesn't need to shell out to a separate
 * script. Both are kept as parallel, independent implementations
 * deliberately — the CLI has zero dependency on the Next.js app being
 * up, which is worth keeping as a fallback (see ADMIN.md).
 */
export async function createBusinessAdmin(
  input: CreateBusinessAdminInput
): Promise<CreateBusinessAdminResult> {
  const email = input.ownerEmail.trim();
  const auth = adminAuth();
  const db = adminDb();

  const tempPassword = randomPassword();

  let ownerUid: string;
  try {
    const created = await auth.createUser({
      email,
      password: tempPassword,
      displayName: input.ownerName.trim(),
    });
    ownerUid = created.uid;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "auth/email-already-exists") {
      throw new Error("An account with this email already exists.");
    }
    throw err;
  }

  const businessRef = db.collection("business").doc();
  await businessRef.set({
    name: input.businessName.trim(),
    ownerUid,
    defaultReorderThreshold: input.defaultReorderThreshold ?? 10,
    logoUrl: input.logoUrl ?? null,
    brandColor: input.brandColor ?? null,
    createdAt: Timestamp.now(),
  });

  await db.collection("users").doc(ownerUid).set({
    uid: ownerUid,
    email,
    displayName: input.ownerName.trim(),
    role: "owner",
    active: true,
    businessId: businessRef.id,
    createdAt: Timestamp.now(),
  });

  return { businessId: businessRef.id, ownerUid, tempPassword };
}

export interface UpdateBusinessAdminInput {
  name?: string;
  defaultReorderThreshold?: number;
  logoUrl?: string | null;
  brandColor?: string | null;
  /** When provided, also toggles the owner's Firebase Auth `disabled`
   * flag AND their /users/{uid}.active field together, so the app's own
   * deactivation UX (toast, forced logout) behaves consistently instead
   * of the owner just hitting a generic Firebase "user-disabled" error
   * next time they try to sign in. */
  ownerActive?: boolean;
}

export async function updateBusinessAdmin(
  businessId: string,
  updates: UpdateBusinessAdminInput
): Promise<void> {
  const db = adminDb();
  const { ownerActive, ...businessFields } = updates;

  if (Object.keys(businessFields).length > 0) {
    await db.collection("business").doc(businessId).update(businessFields);
  }

  if (ownerActive !== undefined) {
    const businessSnap = await db.collection("business").doc(businessId).get();
    const ownerUid = businessSnap.data()?.ownerUid;
    if (ownerUid) {
      await Promise.all([
        adminAuth().updateUser(ownerUid, { disabled: !ownerActive }),
        db.collection("users").doc(ownerUid).update({ active: ownerActive }),
      ]);
    }
  }
}

/** Deletes every document matched by `query`, in batches (Firestore
 * batches cap at 500 writes — chunked at 400 for safety margin). Used by
 * the cascade delete below for every businessId-scoped collection. */
async function deleteQueryBatched(db: Firestore, query: Query): Promise<number> {
  const BATCH_SIZE = 400;
  let deletedCount = 0;

  // Firestore doesn't support offset-based paging efficiently at scale,
  // but for a single small business's data this simple get-and-delete
  // loop (re-querying after each batch commits) is more than sufficient
  // and avoids needing cursor bookkeeping.
  while (true) {
    const snap = await query.limit(BATCH_SIZE).get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();

    deletedCount += snap.size;
    if (snap.size < BATCH_SIZE) break;
  }

  return deletedCount;
}

export interface DeleteBusinessResult {
  deletedCounts: {
    products: number;
    sales: number;
    purchases: number;
    stockMovements: number;
    users: number;
    notifications: number;
  };
  authAccountFailures: string[];
}

/**
 * Irreversibly deletes a business and everything scoped to it: all
 * products, sales, purchases, stock movements, every user account
 * (Firebase Auth + Firestore doc + their notifications subcollection),
 * and finally the business doc itself.
 *
 * Order matters: user-scoped data (notifications, Auth accounts) is
 * cleaned up per-user BEFORE the business doc is deleted, and the
 * business doc is deleted LAST, so a failure partway through never
 * leaves the business doc gone while related data still exists
 * un-owned — the business doc disappearing is the definitive "this is
 * done" signal.
 */
export async function deleteBusinessCascade(businessId: string): Promise<DeleteBusinessResult> {
  const db = adminDb();
  const auth = adminAuth();

  const usersSnap = await db.collection("users").where("businessId", "==", businessId).get();

  let notificationsDeleted = 0;
  const authAccountFailures: string[] = [];

  for (const userDoc of usersSnap.docs) {
    const uid = userDoc.id;

    const notifSnap = await db.collection("notifications").doc(uid).collection("items").get();
    if (!notifSnap.empty) {
      const batch = db.batch();
      notifSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      notificationsDeleted += notifSnap.size;
    }

    try {
      await auth.deleteUser(uid);
    } catch (err) {
      // Account may already be gone, or another transient error — don't
      // let one bad account block deleting the rest of the business.
      authAccountFailures.push(`${uid}: ${(err as Error).message}`);
    }
  }

  const usersDeleted = await deleteQueryBatched(
    db,
    db.collection("users").where("businessId", "==", businessId)
  );

  const [productsDeleted, salesDeleted, purchasesDeleted, movementsDeleted] = await Promise.all([
    deleteQueryBatched(db, db.collection("products").where("businessId", "==", businessId)),
    deleteQueryBatched(db, db.collection("sales").where("businessId", "==", businessId)),
    deleteQueryBatched(db, db.collection("purchases").where("businessId", "==", businessId)),
    deleteQueryBatched(db, db.collection("stockMovements").where("businessId", "==", businessId)),
  ]);

  await db.collection("business").doc(businessId).delete();

  return {
    deletedCounts: {
      products: productsDeleted,
      sales: salesDeleted,
      purchases: purchasesDeleted,
      stockMovements: movementsDeleted,
      users: usersDeleted,
      notifications: notificationsDeleted,
    },
    authAccountFailures,
  };
}
