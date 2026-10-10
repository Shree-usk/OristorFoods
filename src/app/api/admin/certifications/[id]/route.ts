import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { productTaxonomyErrorResponse } from "@/lib/api/product-taxonomy-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { updateCertificationAdmin } from "@/services/product-taxonomy.service";
import { certificationAdminSchema } from "@/validation/product-taxonomy.schema";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = certificationAdminSchema.partial().safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    return NextResponse.json(await updateCertificationAdmin(session.user.id, id, parsed.data));
  } catch (error) {
    return productTaxonomyErrorResponse(error, "PATCH /api/admin/certifications/[id]");
  }
}
