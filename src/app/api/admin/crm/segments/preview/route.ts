import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { crmSegmentationErrorResponse } from "@/lib/api/crm-segmentation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { previewSegment } from "@/services/crm-segmentation.service";
import { segmentFilterCriteriaSchema } from "@/validation/crm-segmentation.schema";

/** STORY-059a. Previews unsaved filter criteria before a segment is saved. */
export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = segmentFilterCriteriaSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await previewSegment(session.user.id, parsed.data));
  } catch (error) {
    return crmSegmentationErrorResponse(error, "POST /api/admin/crm/segments/preview");
  }
}
