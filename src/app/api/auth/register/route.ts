import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { REFERRAL_COOKIE_NAME } from "@/lib/api/referral-cookie";
import { validationErrorResponse } from "@/lib/api/responses";
import { attributeReferralAtRegistration, getOrCreateReferralCode } from "@/services/referral.service";
import { registerSchema } from "@/validation/auth.schema";

/**
 * Minimal account creation (STORY-031's prerequisite — no registration
 * flow existed anywhere before this). Deliberately bare: email+password
 * only, no verification, no password reset. The client signs the caller
 * in via next-auth/react's signIn() right after this succeeds — this
 * route only creates the row and hashes the password, mirroring
 * src/lib/auth.ts's own bcrypt usage exactly.
 */
export async function POST(request: Request) {
  const body: unknown = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return validationErrorResponse(parsed.error);

  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists.", code: "email_in_use" }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({ data: { name: name || null, email, passwordHash } });

  // Best-effort side effects — never block account creation on either of these.
  await getOrCreateReferralCode(user.id).catch((error) => console.error("[referral] failed to generate code at registration", error));
  await attributeReferralAtRegistration({ id: user.id, email: user.email }, request);

  const response = NextResponse.json({ ok: true }, { status: 201 });
  response.cookies.delete(REFERRAL_COOKIE_NAME);
  return response;
}
