import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deletePost, getPostForAdmin, updatePost } from "@/services/blog-admin.service";
import { blogPostAdminSchema } from "@/validation/blog-admin.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const post = await getPostForAdmin(session.user.id, id);
    return NextResponse.json(post);
  } catch (error) {
    return blogAdminErrorResponse(error, "GET /api/admin/blog/posts/[id]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = blogPostAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const post = await updatePost(session.user.id, id, parsed.data);
    return NextResponse.json(post);
  } catch (error) {
    return blogAdminErrorResponse(error, "PATCH /api/admin/blog/posts/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deletePost(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return blogAdminErrorResponse(error, "DELETE /api/admin/blog/posts/[id]");
  }
}
