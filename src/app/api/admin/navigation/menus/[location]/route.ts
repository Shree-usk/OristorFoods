import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { navigationErrorResponse } from "@/lib/api/navigation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getDraftMenu, getPublishedMenu } from "@/services/navigation.service";
import { menuLocationEnum } from "@/validation/navigation.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ location: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { location } = await params;
  const parsed = menuLocationEnum.safeParse(location);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const [draft, published] = await Promise.all([getDraftMenu(session.user.id, parsed.data), getPublishedMenu(session.user.id, parsed.data)]);
    return NextResponse.json({ draft, published });
  } catch (error) {
    return navigationErrorResponse(error, "GET /api/admin/navigation/menus/[location]");
  }
}
