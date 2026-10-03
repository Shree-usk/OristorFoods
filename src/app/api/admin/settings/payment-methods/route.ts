import { NextResponse } from "next/server";

import { adminAuth } from "@/lib/admin-auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { systemSettingsErrorResponse } from "@/lib/api/system-settings-responses";
import { createPaymentMethod, listPaymentMethods } from "@/services/system-settings.service";
import { createPaymentMethodSchema } from "@/validation/system-settings.schema";

export async function GET() {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  try {
    return NextResponse.json(await listPaymentMethods(session.user.id));
  } catch (error) {
    return systemSettingsErrorResponse(error, "GET /api/admin/settings/payment-methods");
  }
}

export async function POST(request: Request) {
  const session = await adminAuth();
  if (!session?.user?.id) return unauthorizedResponse();

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = createPaymentMethodSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    const method = await createPaymentMethod(session.user.id, parsed.data);
    return NextResponse.json(method, { status: 201 });
  } catch (error) {
    return systemSettingsErrorResponse(error, "POST /api/admin/settings/payment-methods");
  }
}
