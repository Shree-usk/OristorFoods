import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { unauthorizedResponse, validationErrorResponse } from "@/lib/api/responses";
import { getProfile, updateProfile } from "@/services/profile.service";
import { updateProfileSchema } from "@/validation/profile.schema";

/** STORY-034. Session-only. Email is intentionally NOT editable here — see /api/account/profile/email. */
export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const user = await getProfile(userId);
  if (!user) return unauthorizedResponse();

  return NextResponse.json({
    name: user.name,
    email: user.email,
    pendingEmail: user.pendingEmail,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    image: user.image,
  });
}

export async function PATCH(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return unauthorizedResponse();

  const body: unknown = await request.json();
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { name, phone, dateOfBirth, image } = parsed.data;
  const user = await updateProfile(userId, {
    name: name || null,
    phone: phone || null,
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
    image: image || null,
  });

  return NextResponse.json({
    name: user.name,
    email: user.email,
    pendingEmail: user.pendingEmail,
    phone: user.phone,
    dateOfBirth: user.dateOfBirth ? user.dateOfBirth.toISOString().slice(0, 10) : null,
    image: user.image,
  });
}
