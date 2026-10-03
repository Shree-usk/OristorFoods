import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { navigationErrorResponse } from "@/lib/api/navigation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { checkMenuLinks } from "@/services/link-check.service";
import { linkCheckSchema } from "@/validation/navigation.schema";

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = linkCheckSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const results = await checkMenuLinks(session.user.id, parsed.data.menuId);
    return NextResponse.json({ results });
  } catch (error) {
    return navigationErrorResponse(error, "POST /api/admin/navigation/link-check");
  }
}
