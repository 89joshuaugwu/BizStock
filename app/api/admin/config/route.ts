import { NextResponse, type NextRequest } from "next/server";
import { AdminAuthError, requireAdminSession } from "@/lib/admin-auth";
import { getPlatformConfigServer, updatePlatformConfigServer } from "@/lib/platform-config";
import type { PlatformConfig } from "@/types/platformConfig";

export async function GET(request: NextRequest) {
  try {
    requireAdminSession(request);
    const config = await getPlatformConfigServer();
    return NextResponse.json({ ok: true, config });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[GET /api/admin/config]", err);
    return NextResponse.json({ ok: false, error: "Failed to load config." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    requireAdminSession(request);
    const body = (await request.json()) as Partial<PlatformConfig>;

    if (body.whatsappNumber !== undefined && !/^\d{7,15}$/.test(body.whatsappNumber)) {
      return NextResponse.json(
        { ok: false, error: "WhatsApp number should be digits only, international format, no + or spaces (e.g. 2348161780381)." },
        { status: 400 }
      );
    }

    await updatePlatformConfigServer(body);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AdminAuthError) {
      return NextResponse.json({ ok: false, error: err.message }, { status: 401 });
    }
    console.error("[PATCH /api/admin/config]", err);
    return NextResponse.json({ ok: false, error: "Failed to save config." }, { status: 500 });
  }
}
