import { NextResponse } from "next/server";

import { adminUserAdminErrorResponse } from "@/lib/api/admin-user-admin-responses";
import { validationErrorResponse } from "@/lib/api/responses";
import { acceptInvite } from "@/services/admin-user-admin.service";
import { acceptInviteSchema } from "@/validation/admin-user-admin.schema";

/** STORY-057. No adminAuth() gate — the invited admin has no session yet. */
export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => ({}));
  const parsed = acceptInviteSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  try {
    await acceptInvite(parsed.data.email, parsed.data.token, parsed.data.name, parsed.data.password);
  } catch (error) {
    return adminUserAdminErrorResponse(error, "POST /api/admin/users/accept-invite");
  }

  return NextResponse.json({ ok: true });
}
