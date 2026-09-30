import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { getPostFormReferenceData } from "@/services/blog-admin.service";

/** Authors/tags for the post form's pickers — one call, not two. */
export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    const data = await getPostFormReferenceData(session.user.id);
    return NextResponse.json(data);
  } catch (error) {
    return blogAdminErrorResponse(error, "GET /api/admin/blog/posts/reference-data");
  }
}
