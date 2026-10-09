import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { instagramErrorResponse } from "@/lib/api/instagram-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { connect, disconnect, getIntegrationStatus } from "@/services/instagram.service";
import { connectInstagramSchema } from "@/validation/instagram-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getIntegrationStatus(session.user.id));
  } catch (error) {
    return instagramErrorResponse(error, "GET /api/admin/settings/integrations/instagram");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = connectInstagramSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await connect(session.user.id, parsed.data.accessToken));
  } catch (error) {
    return instagramErrorResponse(error, "POST /api/admin/settings/integrations/instagram");
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
