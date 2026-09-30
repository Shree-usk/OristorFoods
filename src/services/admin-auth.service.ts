import bcrypt from "bcryptjs";

import * as adminUserRepository from "@/repositories/admin-user.repository";
import { AccountLockedError } from "@/services/admin-auth.errors";
import { writeAuditLog } from "@/services/audit-log.service";

/**
 * DB-persisted lockout (not the in-memory src/lib/rate-limit.ts limiter
 * customer login uses) — an admin lockout must survive a process restart.
 * Threshold/window mirror auth.service.ts's customer login rate limit
 * (max 5 / 15 min) as the documented anchor; see docs/architecture-decisions.md.
 */
const LOCKOUT_THRESHOLD = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

function passwordVersion(passwordChangedAt: Date): number {
  return passwordChangedAt.getTime();
}

/** Read by src/lib/admin-auth.ts's jwt callback on every token refresh to detect a since-changed session. */
export async function getAdminPasswordVersion(adminUserId: string): Promise<number> {
  const adminUser = await adminUserRepository.findById(adminUserId);
  return adminUser ? passwordVersion(adminUser.passwordChangedAt) : 0;
}

export interface AuthenticatedAdminUser {
  id: string;
  name: string;
  email: string;
  passwordVersion: number;
}

/**
 * The admin Credentials provider's sole verification path (src/lib/admin-auth.ts's
 * authorize). Returns null uniformly for "no such account", "wrong
 * password", and "account not Active" — no enumeration, mirroring
 * auth.service.ts::verifyCredentials — EXCEPT a locked account throws a
 * distinguishable AccountLockedError, a deliberate, narrow exception: see
 * admin-auth.errors.ts's doc comment.
 */
export async function verifyAdminCredentials(email: string, password: string): Promise<AuthenticatedAdminUser | null> {
  const adminUser = await adminUserRepository.findByEmail(email);
  if (!adminUser || adminUser.status !== "Active") return null;

  if (adminUser.lockedUntil && adminUser.lockedUntil > new Date()) {
    throw new AccountLockedError(adminUser.lockedUntil);
  }

  const isValid = await bcrypt.compare(password, adminUser.passwordHash);
  if (!isValid) {
    const updated = await adminUserRepository.incrementFailedLoginAttempts(adminUser.id);
    if (updated.failedLoginAttempts >= LOCKOUT_THRESHOLD) {
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MS);
      await adminUserRepository.lockUntil(adminUser.id, lockedUntil);
      await writeAuditLog({ actorId: adminUser.id, action: "account_locked", metadata: { lockedUntil: lockedUntil.toISOString() } });
      // The attempt that crosses the threshold is told immediately, rather
      // than silently locking and letting this attempt look like a plain
      // wrong password — a subsequent correct-password attempt would
      // otherwise fail just as confusingly with no explanation.
      throw new AccountLockedError(lockedUntil);
    }
    await writeAuditLog({ actorId: adminUser.id, action: "login_failed" });
    return null;
  }

  await adminUserRepository.resetFailedLoginAttempts(adminUser.id);
  await writeAuditLog({ actorId: adminUser.id, action: "login_succeeded" });

  return {
    id: adminUser.id,
    name: adminUser.name,
    email: adminUser.email,
    passwordVersion: passwordVersion(adminUser.passwordChangedAt),
  };
}
