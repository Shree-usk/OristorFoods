// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn().mockResolvedValue({ status: "sent" }) }));

// STORY-033: requestPasswordReset sends a real email via notification.service.ts's
// sendTransactionalEmail — mocked here so these tests never touch the network.
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import {
  getPasswordVersion,
  registerCustomer,
  requestPasswordReset,
  resetPassword,
  verifyCredentials,
} from "@/services/auth.service";
import { EmailInUseError, InvalidResetTokenError, ResetTokenExpiredError } from "@/services/auth.errors";
import type { RegisterInput } from "@/validation/auth.schema";

const EMAIL_PREFIX = "auth-svc-";
let sequence = 0;

function nextEmail(): string {
  sequence += 1;
  return `${EMAIL_PREFIX}${sequence}@test.com`;
}

function registerInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  return { name: "Test Customer", email: nextEmail(), password: "Password123", marketingOptIn: false, ...overrides };
}

const noopRequest = () => new Request("http://localhost/api/auth/register");

describe("auth.service", () => {
  describe("registerCustomer", () => {
    it("creates a user with a hashed password and the requested marketing opt-in", async () => {
      const input = registerInput({ marketingOptIn: true });
      const { userId } = await registerCustomer(input, noopRequest());

      const user = await prisma.user.findUnique({ where: { id: userId } });
      expect(user?.email).toBe(input.email);
      expect(user?.marketingOptIn).toBe(true);
      expect(user?.passwordHash).not.toBe(input.password);
      expect(await bcrypt.compare(input.password, user!.passwordHash!)).toBe(true);
      expect(user?.passwordChangedAt).not.toBeNull();
    });

    it("rejects a duplicate email", async () => {
      const input = registerInput();
      await registerCustomer(input, noopRequest());

      await expect(registerCustomer(registerInput({ email: input.email }), noopRequest())).rejects.toThrow(EmailInUseError);
    });
  });

  describe("verifyCredentials", () => {
    it("returns the user on a correct password", async () => {
      const input = registerInput();
      await registerCustomer(input, noopRequest());

      const result = await verifyCredentials(input.email, input.password);
      expect(result?.email).toBe(input.email);
    });

    it("returns null for an unknown email, a wrong password, and (once rate-limited) a correct one — indistinguishably", async () => {
      const input = registerInput();
      await registerCustomer(input, noopRequest());

      expect(await verifyCredentials(nextEmail(), "whatever123")).toBeNull();
      expect(await verifyCredentials(input.email, "WrongPassword1")).toBeNull();

      // Exhaust the rate limit with more wrong attempts, then prove even the correct password is refused.
      for (let i = 0; i < 5; i += 1) await verifyCredentials(input.email, "WrongPassword1");
      expect(await verifyCredentials(input.email, input.password)).toBeNull();
    });
  });

  describe("password reset lifecycle", () => {
    it("resets the password, invalidates the token, and bumps the session password-version", async () => {
      const input = registerInput();
      const { userId } = await registerCustomer(input, noopRequest());
      const versionBeforeReset = await getPasswordVersion(userId);

      await requestPasswordReset(input.email);
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      const [, , body] = mockEmailSend.mock.calls[0] as [string, string, string];
      const token = new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

      const newPassword = "NewPassword456";
      await resetPassword(input.email, token, newPassword);

      expect(await verifyCredentials(input.email, input.password)).toBeNull();
      expect(await verifyCredentials(input.email, newPassword)).not.toBeNull();

      const versionAfterReset = await getPasswordVersion(userId);
      expect(versionAfterReset).not.toBe(versionBeforeReset);

      // The same token can't be replayed.
      await expect(resetPassword(input.email, token, "AnotherPassword789")).rejects.toThrow(InvalidResetTokenError);
    });

    it("rejects an expired token", async () => {
      const input = registerInput();
      await registerCustomer(input, noopRequest());

      await requestPasswordReset(input.email);
      const [, , body] = mockEmailSend.mock.calls[mockEmailSend.mock.calls.length - 1] as [string, string, string];
      const token = new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

      await prisma.verificationToken.updateMany({ where: { identifier: input.email }, data: { expires: new Date(Date.now() - 1000) } });

      await expect(resetPassword(input.email, token, "NewPassword456")).rejects.toThrow(ResetTokenExpiredError);
    });

    it("does not throw and does not send an email for an unregistered address", async () => {
      const callsBefore = mockEmailSend.mock.calls.length;
      await expect(requestPasswordReset(nextEmail())).resolves.toBeUndefined();
      expect(mockEmailSend.mock.calls.length).toBe(callsBefore);
    });
  });
});
