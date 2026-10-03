import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { navigationErrorResponse } from "@/lib/api/navigation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addItem, getDraftMenu } from "@/services/navigation.service";
import { createMenuItemSchema, menuLocationEnum } from "@/validation/navigation.schema";

export async function POST(request: Request, { params }: { params: Promise<{ location: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { location } = await params;
  const parsedLocation = menuLocationEnum.safeParse(location);
  if (!parsedLocation.success) return validationErrorResponse(parsedLocation.error);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createMenuItemSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const draft = await getDraftMenu(session.user.id, parsedLocation.data);
    const item = await addItem(session.user.id, draft.id, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return navigationErrorResponse(error, "POST /api/admin/navigation/menus/[location]/items");
  }
}
