import { createHash, randomBytes } from "node:crypto";

import * as passwordResetRepository from "@/repositories/password-reset.repository";
import * as userRepository from "@/repositories/user.repository";
import { EmailInUseError, InvalidResetTokenError, ResetTokenExpiredError } from "@/services/auth.errors";
import { sendTransactionalEmail } from "@/services/notification.service";

/**
 * STORY-034. Profile edit (name/phone/DOB/photo) and the email-change
 * verification flow. Reuses password-reset.repository.ts's generic
 * VerificationToken wrapper (it's identifier/token/expires, nothing
 * password-reset-specific about it) — identifiers are prefixed
 * `email-verify:${userId}` so a concurrent password-reset request for the
 * same account can never delete this flow's token (or vice versa); they'd
 * otherwise collide on the same VerificationToken.identifier.
 */

const EMAIL_VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

function emailVerifyIdentifier(userId: string): string {
  return `email-verify:${userId}`;
}

function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function getProfile(userId: string) {
  return userRepository.findById(userId);
}

export interface UpdateProfileInput {
  name?: string | null;
  phone?: string | null;
  dateOfBirth?: Date | null;
  image?: string | null;
  marketingOptIn?: boolean;
}

export function updateProfile(userId: string, input: UpdateProfileInput) {
  return userRepository.updateProfile(userId, input);
}

/**
 * Sets `pendingEmail` immediately (so the profile page can show "check
 * your inbox at new@address") but leaves `email` — and therefore login —
 * untouched until `confirmEmailChange` verifies the mailed link.
 */
export async function requestEmailChange(userId: string, newEmail: string): Promise<void> {
  const taken = await userRepository.isEmailTaken(newEmail, userId);
  if (taken) throw new EmailInUseError();

  await userRepository.setPendingEmail(userId, newEmail);

  const rawToken = randomBytes(32).toString("hex");
  const identifier = emailVerifyIdentifier(userId);
  await passwordResetRepository.deleteAllForIdentifier(identifier);
  await passwordResetRepository.create({
    identifier,
    token: hashToken(rawToken),
    expires: new Date(Date.now() + EMAIL_VERIFY_TTL_MS),
  });

  const verifyUrl = new URL("/account/profile/verify-email", process.env.NEXT_PUBLIC_SITE_URL ?? "https://oristor.com");
  verifyUrl.searchParams.set("token", rawToken);
  verifyUrl.searchParams.set("userId", userId);

  await sendTransactionalEmail(
    newEmail,
    "Confirm your new Oristor email address",
    `Confirm this email address to finish updating your Oristor account. This link expires in 24 hours:\n\n${verifyUrl.toString()}\n\nIf you didn't request this, you can safely ignore this email — your address won't change.`,
  );
}

export async function confirmEmailChange(userId: string, rawToken: string): Promise<void> {
  const identifier = emailVerifyIdentifier(userId);
  const record = await passwordResetRepository.findByIdentifierAndToken(identifier, hashToken(rawToken));
  if (!record) throw new InvalidResetTokenError();

  if (record.expires < new Date()) {
    await passwordResetRepository.deleteAllForIdentifier(identifier);
    throw new ResetTokenExpiredError();
  }

  const user = await userRepository.findById(userId);
  if (!user?.pendingEmail) throw new InvalidResetTokenError();

  const taken = await userRepository.isEmailTaken(user.pendingEmail, userId);
  if (taken) throw new EmailInUseError();

  await userRepository.confirmPendingEmail(userId, user.pendingEmail);
  await passwordResetRepository.deleteAllForIdentifier(identifier);
}

export function requestAccountDeactivation(userId: string, reason: string | null) {
  return userRepository.requestDeactivation(userId, reason);
}
