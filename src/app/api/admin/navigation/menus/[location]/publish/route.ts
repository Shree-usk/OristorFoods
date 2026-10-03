import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { navigationErrorResponse } from "@/lib/api/navigation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getDraftMenu, publishMenu } from "@/services/navigation.service";
import { menuLocationEnum } from "@/validation/navigation.schema";

export async function POST(_request: Request, { params }: { params: Promise<{ location: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { location } = await params;
  const parsedLocation = menuLocationEnum.safeParse(location);
  if (!parsedLocation.success) return validationErrorResponse(parsedLocation.error);

  try {
    const draft = await getDraftMenu(session.user.id, parsedLocation.data);
    const published = await publishMenu(session.user.id, draft.id);
    return NextResponse.json(published);
  } catch (error) {
    return navigationErrorResponse(error, "POST /api/admin/navigation/menus/[location]/publish");
  }
}
