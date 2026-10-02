import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { serverErrorResponse, unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { PermissionDeniedError } from "@/services/permission.errors";
import { getSeoMeta, updateSeoMeta } from "@/services/seo.service";
import { seoEntityTypeEnum, seoMetaSchema } from "@/validation/seo.schema";

/** No dedicated xxx-admin-responses.ts helper — seo.service.ts has no custom Service errors to map beyond what requirePermission already throws. */
function seoErrorResponse(error: unknown, context: string) {
  if (error instanceof PermissionDeniedError) return NextResponse.json({ error: error.message }, { status: 403 });
  return serverErrorResponse(error, context);
}

export async function GET(_request: Request, { params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { entityType, entityId } = await params;
  const parsedType = seoEntityTypeEnum.safeParse(entityType);
  if (!parsedType.success) return validationErrorResponse(parsedType.error);

  try {
    const seoMeta = await getSeoMeta(session.user.id, parsedType.data, entityId);
    return NextResponse.json(seoMeta);
  } catch (error) {
    return seoErrorResponse(error, "GET /api/admin/seo/[entityType]/[entityId]");
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ entityType: string; entityId: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { entityType, entityId } = await params;
  const parsedType = seoEntityTypeEnum.safeParse(entityType);
  if (!parsedType.success) return validationErrorResponse(parsedType.error);

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = seoMetaSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const seoMeta = await updateSeoMeta(session.user.id, parsedType.data, entityId, {
      metaTitle: parsed.data.metaTitle ?? null,
      metaDescription: parsed.data.metaDescription ?? null,
      canonicalUrl: parsed.data.canonicalUrl || null,
      ogImageUrl: parsed.data.ogImageUrl ?? null,
      ogImageAlt: parsed.data.ogImageAlt ?? null,
      robotsIndex: parsed.data.robotsIndex ?? true,
      robotsFollow: parsed.data.robotsFollow ?? true,
      focusKeyword: parsed.data.focusKeyword ?? null,
    });
    return NextResponse.json(seoMeta);
  } catch (error) {
    return seoErrorResponse(error, "PATCH /api/admin/seo/[entityType]/[entityId]");
  }
}
