import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { collectionErrorResponse } from "@/lib/api/collection-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createCollectionAdmin, listCollectionsForAdmin } from "@/services/collection.service";
import { collectionAdminSchema } from "@/validation/collection-admin.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listCollectionsForAdmin(session.user.id));
  } catch (error) {
    return collectionErrorResponse(error, "GET /api/admin/collections");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = collectionAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const collection = await createCollectionAdmin(session.user.id, parsed.data);
    return NextResponse.json(collection, { status: 201 });
  } catch (error) {
    return collectionErrorResponse(error, "POST /api/admin/collections");
  }
}
