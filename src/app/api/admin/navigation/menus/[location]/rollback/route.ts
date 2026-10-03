import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { navigationErrorResponse } from "@/lib/api/navigation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { rollbackMenu } from "@/services/navigation.service";
import { menuLocationEnum } from "@/validation/navigation.schema";

export async function POST(_request: Request, { params }: { params: Promise<{ location: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { location } = await params;
  const parsedLocation = menuLocationEnum.safeParse(location);
  if (!parsedLocation.success) return validationErrorResponse(parsedLocation.error);

  try {
    const published = await rollbackMenu(session.user.id, parsedLocation.data);
    return NextResponse.json(published);
  } catch (error) {
    return navigationErrorResponse(error, "POST /api/admin/navigation/menus/[location]/rollback");
  }
}
