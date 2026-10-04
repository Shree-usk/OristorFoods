import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { storyPageErrorResponse } from "@/lib/api/story-page-responses";
import { getContactPageCopyForAdmin, saveContactPageCopy } from "@/services/story-page.service";
import { contactPageCopySchema } from "@/validation/story-page.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await getContactPageCopyForAdmin(session.user.id));
  } catch (error) {
    return storyPageErrorResponse(error, "GET /api/admin/story-pages/contact-copy");
  }
}

export async function PUT(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = contactPageCopySchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await saveContactPageCopy(session.user.id, parsed.data));
  } catch (error) {
    return storyPageErrorResponse(error, "PUT /api/admin/story-pages/contact-copy");
  }
}
