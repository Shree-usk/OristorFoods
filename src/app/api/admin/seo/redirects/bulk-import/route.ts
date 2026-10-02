import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { redirectAdminErrorResponse } from "@/lib/api/redirect-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { bulkImportRedirects } from "@/services/redirect.service";
import { bulkImportRedirectsSchema } from "@/validation/redirect.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bulkImportRedirectsSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const result = await bulkImportRedirects(session.user.id, parsed.data.csv);
    return NextResponse.json(result);
  } catch (error) {
    return redirectAdminErrorResponse(error, "POST /api/admin/seo/redirects/bulk-import");
  }
}
