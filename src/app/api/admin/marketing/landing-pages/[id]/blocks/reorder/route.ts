import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { landingPageAdminErrorResponse } from "@/lib/api/landing-page-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { reorderBlocks } from "@/services/landing-page.service";
import { reorderBlocksSchema } from "@/validation/landing-page.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = reorderBlocksSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await reorderBlocks(session.user.id, id, parsed.data.blockIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return landingPageAdminErrorResponse(error, "POST /api/admin/marketing/landing-pages/[id]/blocks/reorder");
  }
}
