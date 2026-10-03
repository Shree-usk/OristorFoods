import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { serverErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError } from "@/services/permission.errors";
import { bulkApplyTitleTemplate } from "@/services/seo-pages.service";
import { bulkApplyTitleTemplateSchema } from "@/validation/seo.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkApplyTitleTemplateSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkApplyTitleTemplate(session.user.id, parsed.data.refs, parsed.data.template);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
    return serverErrorResponse(error, "POST /api/admin/seo/pages/bulk-apply-title");
  }
}
