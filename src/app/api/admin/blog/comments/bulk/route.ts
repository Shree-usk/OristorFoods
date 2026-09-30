import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkModerateComments } from "@/services/blog-admin.service";
import { bulkModerateCommentsSchema } from "@/validation/blog-admin.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkModerateCommentsSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkModerateComments(session.user.id, parsed.data.ids, parsed.data.action);
    return NextResponse.json(result);
  } catch (error) {
    return blogAdminErrorResponse(error, "POST /api/admin/blog/comments/bulk");
  }
}
