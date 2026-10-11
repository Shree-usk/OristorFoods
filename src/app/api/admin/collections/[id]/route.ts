import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { collectionErrorResponse } from "@/lib/api/collection-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateCollectionAdmin } from "@/services/collection.service";
import { collectionAdminSchema } from "@/validation/collection-admin.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = collectionAdminSchema.partial().safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateCollectionAdmin(session.user.id, id, parsed.data));
  } catch (error) {
    return collectionErrorResponse(error, "PATCH /api/admin/collections/[id]");
  }
}
