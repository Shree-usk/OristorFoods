import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { publishPost } from "@/services/blog-admin.service";
import { publishBlogPostSchema } from "@/validation/blog-admin.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = publishBlogPostSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const post = await publishPost(session.user.id, id, parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : undefined);
    return NextResponse.json(post);
  } catch (error) {
    return blogAdminErrorResponse(error, "POST /api/admin/blog/posts/[id]/publish");
  }
}
