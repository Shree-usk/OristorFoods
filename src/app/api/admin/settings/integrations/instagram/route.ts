import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { instagramErrorResponse } from "@/lib/api/instagram-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { disconnect, getIntegrationStatus } from "@/services/instagram.service";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getIntegrationStatus(session.user.id));
  } catch (error) {
    return instagramErrorResponse(error, "GET /api/admin/settings/integrations/instagram");
  }
}

export async function DELETE() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    await disconnect(session.user.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return instagramErrorResponse(error, "DELETE /api/admin/settings/integrations/instagram");
  }
}
