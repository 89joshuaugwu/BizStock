import { NextResponse, type NextRequest } from "next/server";
import { AdminAuthError, requireAdminSession } from "@/lib/admin-auth";
import { deleteBusinessCascade, updateBusinessAdmin, type UpdateBusinessAdminInput } from "@/lib/admin-businesses";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdminSession(request);
    const { id } = await params;

    const body = (await request.json()) as UpdateBusinessAdminInput;

    if (body.brandColor && !/^#([0-9A-Fa-f]{6})$/.test(body.brandColor)) {
      return NextResponse.json({ ok: false, error: "Brand color must be a hex code like #7C3AED." }, { status: 400 });
    }
    if (body.defaultReorderThreshold !== undefined && (!Number.isFinite(body.defaultReorderThreshold) || body.defaultReorderThreshold < 0)) {
      return NextResponse.json({ ok: false, error: "Invalid default reorder threshold." }, { status: 400 });
    }

    await updateBusinessAdmin(id, body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[PATCH /api/admin/businesses/:id]", err);
    return NextResponse.json({ ok: false, error: "Failed to update business." }, { status: 500 });
  }
}

/**
 * Irreversible. The client is expected to have already confirmed this
 * with the admin (type-the-business-name-to-confirm, see the admin
 * page) — this route does not ask again, it just executes.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    requireAdminSession(request);
    const { id } = await params;

    const result = await deleteBusinessCascade(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[DELETE /api/admin/businesses/:id]", err);
    return NextResponse.json({ ok: false, error: "Failed to delete business." }, { status: 500 });
  }
}
