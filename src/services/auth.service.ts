import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import { checkRateLimit, resetRateLimit } from "@/lib/rate-limit";
import * as loginEventRepository from "@/repositories/login-event.repository";
import * as passwordResetRepository from "@/repositories/password-reset.repository";
import * as userRepository from "@/repositories/user.repository";
import { attributeReferralAtRegistration, getOrCreateReferralCode } from "@/services/referral.service";
import { sendTransactionalEmail } from "@/services/notification.service";
import { AccountSuspendedError, EmailInUseError, InvalidResetTokenError, ResetTokenExpiredError } from "@/services/auth.errors";
import type { RegisterInput } from "@/validation/auth.schema";

const LOGIN_RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const RESET_REQUEST_RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** 0 for a user who has never set a password change stamp — never matches a real, later reset. */
function passwordVersion(passwordChangedAt: Date | null): number {
  return passwordChangedAt ? passwordChangedAt.getTime() : 0;
}

function hashResetToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/** Read by src/lib/auth.ts's jwt callback on every token refresh to detect a since-reset session. */
export async function getPasswordVersion(userId: string): Promise<number> {
  const user = await userRepository.findById(userId);
  return passwordVersion(user?.passwordChangedAt ?? null);
}

export interface AuthenticatedUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  passwordVersion: number;
}

/**
 * The Credentials provider's sole verification path (src/lib/auth.ts's
 * authorize). Returns null uniformly for "no such user", "no password
 * set" (an OAuth-only account, once those exist), "wrong password", and
 * "rate limited" — the caller must never be able to distinguish these,
 * per the story's no-enumeration AC. STORY-048: once the password has
 * verified correctly, a Suspended account throws AccountSuspendedError
 * instead (see that error's own doc comment for why this one case is a
 * deliberate exception to the no-enumeration rule), and every outcome
 * from that point on writes a LoginEvent (best-effort IP/user-agent
 * from `request`, present only when NextAuth's authorize passes one
 * through) — but never for a nonexistent email, so LoginEvent can't be
 * used to enumerate registered addresses either.
 */
export async function verifyCredentials(email: string, password: string, request?: Request): Promise<AuthenticatedUser | null> {
  const rateLimitKey = `login:${email.toLowerCase()}`;
  if (!checkRateLimit(rateLimitKey, LOGIN_RATE_LIMIT)) return null;

  const user = await userRepository.findByEmail(email);
  if (!user?.passwordHash) return null;

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    await recordLoginEvent(user.id, false, request);
    return null;
  }

  if (user.status === "Suspended") {
    await recordLoginEvent(user.id, false, request);
    throw new AccountSuspendedError();
  }

  resetRateLimit(rateLimitKey);
  await recordLoginEvent(user.id, true, request);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    passwordVersion: passwordVersion(user.passwordChangedAt),
  };
}

function recordLoginEvent(userId: string, success: boolean, request?: Request): Promise<unknown> {
  const ipAddress = request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const userAgent = request?.headers.get("user-agent") ?? null;
  return loginEventRepository.createLoginEvent({ userId, success, ipAddress, userAgent });
}

export async function registerCustomer(input: RegisterInput, request: Request): Promise<{ userId: string }> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) throw new EmailInUseError();

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await userRepository.create({
    name: input.name || null,
    email: input.email,
    passwordHash,
    marketingOptIn: input.marketingOptIn ?? false,
    passwordChangedAt: new Date(),
  });

  // Best-effort side effects — never block account creation on either of these.
  await getOrCreateReferralCode(user.id).catch((error) => console.error("[auth] failed to generate referral code at registration", error));
  await attributeReferralAtRegistration({ id: user.id, email: user.email }, request);

  return { userId: user.id };
}

/**
 * Always resolves the same way whether or not `email` belongs to an
 * account — the route handler returns 200 either way — so a caller can
 * never use this to enumerate registered emails.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  if (!checkRateLimit(`reset:${email.toLowerCase()}`, RESET_REQUEST_RATE_LIMIT)) return;

  const user = await userRepository.findByEmail(email);
  if (!user?.email) return;

  const rawToken = randomBytes(32).toString("hex");
  await passwordResetRepository.deleteAllForIdentifier(user.email);
  await passwordResetRepository.create({
    identifier: user.email,
    token: hashResetToken(rawToken),
    expires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });

  const resetUrl = new URL("/account/reset-password", process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com");
  resetUrl.searchParams.set("token", rawToken);
  resetUrl.searchParams.set("email", user.email);

  await sendTransactionalEmail(
    user.email,
    "Reset your Oristor password",
    `We received a request to reset your Oristor password. This link expires in 1 hour:\n\n${resetUrl.toString()}\n\nIf you didn't request this, you can safely ignore this email — your password won't change.`,
  );
}

/**
 * Verifies the mailed token, updates the hash, and invalidates every
 * outstanding reset token for this identifier (both the one just used
 * and any earlier, unused ones). Bumping `passwordChangedAt`
 * (userRepository.updatePassword) is what makes src/lib/auth.ts's jwt
 * callback reject any session issued before this reset.
 */
export async function resetPassword(email: string, rawToken: string, newPassword: string): Promise<void> {
  const tokenHash = hashResetToken(rawToken);
  const record = await passwordResetRepository.findByIdentifierAndToken(email, tokenHash);
  if (!record) throw new InvalidResetTokenError();

  if (record.expires < new Date()) {
    await passwordResetRepository.deleteAllForIdentifier(email);
    throw new ResetTokenExpiredError();
  }

  const user = await userRepository.findByEmail(email);
  if (!user) throw new InvalidResetTokenError();

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.updatePassword(user.id, passwordHash);
  await passwordResetRepository.deleteAllForIdentifier(email);
}
