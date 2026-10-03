import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { navigationErrorResponse } from "@/lib/api/navigation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getDraftMenu, removeItem, updateItem } from "@/services/navigation.service";
import { menuLocationEnum, updateMenuItemSchema } from "@/validation/navigation.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ location: string; itemId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { location, itemId } = await params;
  const parsedLocation = menuLocationEnum.safeParse(location);
  if (!parsedLocation.success) return validationErrorResponse(parsedLocation.error);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = updateMenuItemSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const draft = await getDraftMenu(session.user.id, parsedLocation.data);
    const item = await updateItem(session.user.id, draft.id, itemId, parsed.data);
    return NextResponse.json(item);
  } catch (error) {
    return navigationErrorResponse(error, "PATCH /api/admin/navigation/menus/[location]/items/[itemId]");
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ location: string; itemId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { location, itemId } = await params;
  const parsedLocation = menuLocationEnum.safeParse(location);
  if (!parsedLocation.success) return validationErrorResponse(parsedLocation.error);

  try {
    const draft = await getDraftMenu(session.user.id, parsedLocation.data);
    await removeItem(session.user.id, draft.id, itemId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return navigationErrorResponse(error, "DELETE /api/admin/navigation/menus/[location]/items/[itemId]");
  }
}
