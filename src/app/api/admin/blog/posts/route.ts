import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createPost, listPostsForAdmin } from "@/services/blog-admin.service";
import { blogPostAdminSchema, listBlogPostsQuerySchema } from "@/validation/blog-admin.schema";

export async function GET(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { searchParams } = new URL(request.url);
  const parsed = listBlogPostsQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) return validationErrorResponse(parsed.error);
  const { page, pageSize, status, search } = parsed.data;

  try {
    const result = await listPostsForAdmin(session.user.id, { status, search }, page, pageSize);
    return NextResponse.json(result);
  } catch (error) {
    return blogAdminErrorResponse(error, "GET /api/admin/blog/posts");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = blogPostAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const post = await createPost(session.user.id, parsed.data);
    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    return blogAdminErrorResponse(error, "POST /api/admin/blog/posts");
  }
}
