import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { versioningErrorResponse } from "@/lib/api/versioning-responses";
import { listVersions } from "@/services/versioning.service";
import { versionedEntityTypeEnum } from "@/validation/versioning.schema";

export async function GET(_request: Request, { params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { entityType, entityId } = await params;
  const parsed = versionedEntityTypeEnum.safeParse(entityType);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const versions = await listVersions(session.user.id, parsed.data, entityId);
    return NextResponse.json(versions);
  } catch (error) {
    return versioningErrorResponse(error, "GET /api/admin/cms/versions/[entityType]/[entityId]");
  }
}
