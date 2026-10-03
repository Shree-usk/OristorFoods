import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { versioningErrorResponse } from "@/lib/api/versioning-responses";
import { diffVersions } from "@/services/versioning.service";
import { diffVersionsQuerySchema, versionedEntityTypeEnum } from "@/validation/versioning.schema";

export async function GET(request: Request, { params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { entityType } = await params;
  const parsedType = versionedEntityTypeEnum.safeParse(entityType);
  if (!parsedType.success) return validationErrorResponse(parsedType.error);

  const url = new URL(request.url);
  const parsedQuery = diffVersionsQuerySchema.safeParse({ a: url.searchParams.get("a"), b: url.searchParams.get("b") });
  if (!parsedQuery.success) return validationErrorResponse(parsedQuery.error);

  try {
    const diff = await diffVersions(session.user.id, parsedType.data, parsedQuery.data.a, parsedQuery.data.b);
    return NextResponse.json({ diff });
  } catch (error) {
    return versioningErrorResponse(error, "GET /api/admin/cms/versions/[entityType]/[entityId]/diff");
  }
}
