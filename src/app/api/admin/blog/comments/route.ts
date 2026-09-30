import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { listCommentsForAdmin } from "@/services/blog-admin.service";
import { listBlogCommentsQuerySchema } from "@/validation/blog-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listBlogCommentsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, postId, status, search } = parsed.data;

  try {
    const result = await listCommentsForAdmin(session.user.id, { postId, status, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return blogAdminErrorResponse(error, "GET /api/admin/blog/comments");
  }
}
