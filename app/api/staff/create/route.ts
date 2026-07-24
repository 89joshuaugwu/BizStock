import { NextResponse, type NextRequest } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminAuth, adminDb } from "@/lib/firebase-admin";
import { requireUser, requireOwner, ApiAuthError } from "@/lib/api-auth";

interface CreateStaffRequest {
  name: string;
  email: string;
  tempPassword: string;
}

/**
 * Creates a staff account. OWNER ONLY. Mirrors PharmaLedger's attendant
 * provisioning pattern (CONTEXT.md Section 6): the Firebase Auth user and
 * the /users/{uid} Firestore doc are created together, server-side, with
 * firebase-admin — this can't be done from the client because staff have
 * no public signup and creating a Firebase Auth account requires elevated
 * privileges.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireUser(request);
    requireOwner(user);

    const body = (await request.json()) as CreateStaffRequest;

    if (!body.name?.trim()) {
      return NextResponse.json({ ok: false, error: "Staff name is required." }, { status: 400 });
    }
    if (!body.email?.trim()) {
      return NextResponse.json({ ok: false, error: "Staff email is required." }, { status: 400 });
    }
    if (!body.tempPassword || body.tempPassword.length < 6) {
      return NextResponse.json(
        { ok: false, error: "Temporary password must be at least 6 characters." },
        { status: 400 }
      );
    }

    let staffUid: string;
    try {
      const created = await adminAuth().createUser({
        email: body.email.trim(),
        password: body.tempPassword,
        displayName: body.name.trim(),
      });
      staffUid = created.uid;
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === "auth/email-already-exists") {
        return NextResponse.json(
          { ok: false, error: "An account with this email already exists." },
          { status: 409 }
        );
      }
      throw err;
    }

    await adminDb().collection("users").doc(staffUid).set({
      uid: staffUid,
      email: body.email.trim(),
      displayName: body.name.trim(),
      role: "staff",
      active: true,
      createdAt: Timestamp.now(),
    });

    return NextResponse.json({ ok: true, uid: staffUid });
  } catch (err) {
    if (err instanceof ApiAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: err.status });
    }
    console.error("[/api/staff/create]", err);
    return NextResponse.json({ ok: false, error: "Failed to create staff account." }, { status: 500 });
  }
}
