import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productTaxonomyErrorResponse } from "@/lib/api/product-taxonomy-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { createCertificationAdmin, listCertificationsForAdmin } from "@/services/product-taxonomy.service";
import { certificationAdminSchema } from "@/validation/product-taxonomy.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listCertificationsForAdmin(session.user.id));
  } catch (error) {
    return productTaxonomyErrorResponse(error, "GET /api/admin/certifications");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = certificationAdminSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const certification = await createCertificationAdmin(session.user.id, parsed.data);
    return NextResponse.json(certification, { status: 201 });
  } catch (error) {
    return productTaxonomyErrorResponse(error, "POST /api/admin/certifications");
  }
}
