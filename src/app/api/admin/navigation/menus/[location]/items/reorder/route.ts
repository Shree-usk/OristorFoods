import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { navigationErrorResponse } from "@/lib/api/navigation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getDraftMenu, reorderItems } from "@/services/navigation.service";
import { menuLocationEnum, reorderMenuItemsSchema } from "@/validation/navigation.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ location: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { location } = await params;
  const parsedLocation = menuLocationEnum.safeParse(location);
  if (!parsedLocation.success) return validationErrorResponse(parsedLocation.error);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = reorderMenuItemsSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const draft = await getDraftMenu(session.user.id, parsedLocation.data);
    await reorderItems(session.user.id, draft.id, parsed.data.parentId, parsed.data.orderedItemIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return navigationErrorResponse(error, "PATCH /api/admin/navigation/menus/[location]/items/reorder");
  }
}
