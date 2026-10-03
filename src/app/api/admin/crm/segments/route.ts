import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { crmSegmentationErrorResponse } from "@/lib/api/crm-segmentation-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createSegment, listSegments } from "@/services/crm-segmentation.service";
import { createSegmentSchema } from "@/validation/crm-segmentation.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listSegments(session.user.id));
  } catch (error) {
    return crmSegmentationErrorResponse(error, "GET /api/admin/crm/segments");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createSegmentSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const segment = await createSegment(session.user.id, parsed.data);
    return NextResponse.json(segment, { status: 201 });
  } catch (error) {
    return crmSegmentationErrorResponse(error, "POST /api/admin/crm/segments");
  }
}
