import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { instagramErrorResponse } from "@/lib/api/instagram-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { syncNow } from "@/services/instagram.service";

export async function POST() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    await syncNow(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return instagramErrorResponse(error, "POST /api/admin/settings/integrations/instagram/sync");
  }
}
