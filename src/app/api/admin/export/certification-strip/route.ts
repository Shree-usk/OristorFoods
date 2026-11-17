import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { exportContentErrorResponse } from "@/lib/api/export-content-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { addCertificationStripItem, listCertificationStripItemsForAdmin } from "@/services/export-content.service";
import { exportCertificationStripItemSchema } from "@/validation/export-content.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listCertificationStripItemsForAdmin(session.user.id));
  } catch (error) {
    return exportContentErrorResponse(error, "GET /api/admin/export/certification-strip");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = exportCertificationStripItemSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const item = await addCertificationStripItem(session.user.id, parsed.data);
    return NextResponse.json(item, { status: 201 });
  } catch (error) {
    return exportContentErrorResponse(error, "POST /api/admin/export/certification-strip");
  }
}
