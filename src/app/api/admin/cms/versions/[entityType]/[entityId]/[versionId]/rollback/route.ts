import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { versioningErrorResponse } from "@/lib/api/versioning-responses";
import { restoreFromVersion as restoreBlogPost } from "@/services/blog-admin.service";
import { restoreLayoutFromVersion } from "@/services/homepage-builder.service";
import { restoreFromVersion as restoreRecipe } from "@/services/recipe-admin.service";
import { versionedEntityTypeEnum } from "@/validation/versioning.schema";

/** Dispatches to the right content type's own restore function — each content type owns how a snapshot gets applied back (see each service's restoreFromVersion/restoreLayoutFromVersion), this route is just the routing table. */
export async function POST(_request: Request, { params }: { params: Promise<{ entityType: string; entityId: string; versionId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { entityType, entityId, versionId } = await params;
  const parsed = versionedEntityTypeEnum.safeParse(entityType);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const restored =
      parsed.data === "HomepageLayout"
        ? await restoreLayoutFromVersion(session.user.id, versionId)
        : parsed.data === "Recipe"
          ? await restoreRecipe(session.user.id, entityId, versionId)
          : await restoreBlogPost(session.user.id, entityId, versionId);
    return NextResponse.json(restored);
  } catch (error) {
    return versioningErrorResponse(error, "POST /api/admin/cms/versions/[entityType]/[entityId]/[versionId]/rollback");
  }
}
