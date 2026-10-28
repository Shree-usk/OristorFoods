import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createAuthor, listAuthorsForAdmin } from "@/services/blog-admin.service";
import { blogAuthorAdminSchema } from "@/validation/blog-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listAuthorsForAdmin(session.user.id));
  } catch (error) {
    return blogAdminErrorResponse(error, "GET /api/admin/blog/authors");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = blogAuthorAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const author = await createAuthor(session.user.id, parsed.data);
    return NextResponse.json(author, { status: 201 });
  } catch (error) {
    return blogAdminErrorResponse(error, "POST /api/admin/blog/authors");
  }
}
