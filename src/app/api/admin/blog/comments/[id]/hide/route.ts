import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { blogAdminErrorResponse } from "@/lib/api/blog-admin-responses";
import { unauthorizedResponse } from "@/lib/api/responses";
import { hideComment } from "@/services/blog-admin.service";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  try {
    const comment = await hideComment(session.user.id, id);
    return NextResponse.json(comment);
  } catch (error) {
    return blogAdminErrorResponse(error, "POST /api/admin/blog/comments/[id]/hide");
  }
}
