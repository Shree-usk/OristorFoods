import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { deleteAuthor, updateAuthor } from "@/services/blog-admin.service";
import { blogAuthorAdminSchema } from "@/validation/blog-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = blogAuthorAdminSchema.partial().safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateAuthor(session.user.id, id, parsed.data));
  } catch (error) {
    return blogAdminErrorResponse(error, "PATCH /api/admin/blog/authors/[id]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    await deleteAuthor(session.user.id, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return blogAdminErrorResponse(error, "DELETE /api/admin/blog/authors/[id]");
  }
}
