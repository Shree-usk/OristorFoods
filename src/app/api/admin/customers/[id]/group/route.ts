import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { customerAdminErrorResponse } from "@/lib/api/customer-admin-responses";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { setCustomerGroup } from "@/services/customer-admin.service";
import { setCustomerGroupSchema } from "@/validation/customer-admin.schema";

/** STORY-071. The minimal admin-customer capability this story ships — see customer-admin.service.ts's header comment. STORY-048 builds the full console on top of this. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const { id } = await params;
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = setCustomerGroupSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const customer = await setCustomerGroup(session.user.id, id, parsed.data.customerGroup);
    return NextResponse.json(customer);
  } catch (error) {
    return customerAdminErrorResponse(error, "PATCH /api/admin/customers/[id]/group");
  }
}
