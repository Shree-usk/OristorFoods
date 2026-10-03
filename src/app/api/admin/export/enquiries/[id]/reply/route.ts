import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportEnquiryErrorResponse } from "@/lib/api/export-enquiry-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { replyToEnquiry } from "@/services/export-enquiry.service";
import { replyToEnquirySchema } from "@/validation/export-enquiry.schema";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = replyToEnquirySchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await replyToEnquiry(session.user.id, id, parsed.data.subject, parsed.data.body);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return exportEnquiryErrorResponse(error, "POST /api/admin/export/enquiries/[id]/reply");
  }
}
