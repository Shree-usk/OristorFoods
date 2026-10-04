import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { storyPageErrorResponse } from "@/lib/api/story-page-responses";
import { getStoryPageBlocksForAdmin, saveStoryPageBlocks } from "@/services/story-page.service";
import { saveStoryPageBlocksSchema, storyPageParamSchema } from "@/validation/story-page.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ page: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { page } = await params;
  const parsedPage = storyPageParamSchema.safeParse(page);
  if (!parsedPage.success) return validationErrorResponse(parsedPage.error);

  try {
    return NextResponse.json(await getStoryPageBlocksForAdmin(session.user.id, parsedPage.data));
  } catch (error) {
    return storyPageErrorResponse(error, "GET /api/admin/story-pages/[page]");
  }
}

export async function PUT(request: Request, { params }: { params: Promise<{ page: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { page } = await params;
  const parsedPage = storyPageParamSchema.safeParse(page);
  if (!parsedPage.success) return validationErrorResponse(parsedPage.error);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = saveStoryPageBlocksSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await saveStoryPageBlocks(session.user.id, parsedPage.data, parsed.data.blocks));
  } catch (error) {
    return storyPageErrorResponse(error, "PUT /api/admin/story-pages/[page]");
  }
}
