import { NextResponse, type NextRequest } from "next/server";
import { AdminAuthError, requireAdminSession } from "@/lib/admin-auth";
import { createBusinessAdmin, listBusinessesAdmin, type CreateBusinessAdminInput } from "@/lib/admin-businesses";

export async function GET(request: NextRequest) {
  try {
    requireAdminSession(request);
    const businesses = await listBusinessesAdmin();
    return NextResponse.json({ ok: true, businesses });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[GET /api/admin/businesses]", err);
    return NextResponse.json({ ok: false, error: "Failed to load businesses." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    requireAdminSession(request);

    const body = (await request.json()) as Partial<CreateBusinessAdminInput>;

    if (!body.businessName?.trim()) {
      return NextResponse.json({ ok: false, error: "Business name is required." }, { status: 400 });
    }
    if (!body.ownerName?.trim()) {
      return NextResponse.json({ ok: false, error: "Owner name is required." }, { status: 400 });
    }
    if (!body.ownerEmail?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.ownerEmail)) {
      return NextResponse.json({ ok: false, error: "A valid owner email is required." }, { status: 400 });
    }
    if (body.brandColor && !/^#([0-9A-Fa-f]{6})$/.test(body.brandColor)) {
      return NextResponse.json({ ok: false, error: "Brand color must be a hex code like #7C3AED." }, { status: 400 });
    }

    const result = await createBusinessAdmin({
      businessName: body.businessName,
      ownerName: body.ownerName,
      ownerEmail: body.ownerEmail,
      defaultReorderThreshold: body.defaultReorderThreshold,
      logoUrl: body.logoUrl ?? null,
      brandColor: body.brandColor ?? null,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Failed to create business.";
    console.error("[POST /api/admin/businesses]", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
