import bcrypt from "bcryptjs";

import * as userRepository from "@/repositories/user.repository";
import { IncorrectCurrentPasswordError } from "@/services/security.errors";

/**
 * STORY-034. Sessions are JWT-only with no per-session tracking (see
 * src/lib/auth.ts's jwt callback) — there is no way to identify "this
 * device" vs "other devices". Both a password change and "log out of all
 * devices" therefore invalidate EVERY session, including the one making
 * the request (bumping User.passwordChangedAt, exactly like STORY-033's
 * password reset) — the customer re-authenticates afterward. This is a
 * deliberate scope decision; see docs/architecture-decisions.md.
 */

export async function changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
  const user = await userRepository.findById(userId);
  if (!user?.passwordHash) throw new IncorrectCurrentPasswordError();

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) throw new IncorrectCurrentPasswordError();

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await userRepository.updatePassword(userId, passwordHash);
}

export function logOutAllDevices(userId: string): Promise<unknown> {
  return userRepository.bumpSessionVersion(userId);
}
