// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn().mockResolvedValue({ status: "sent" }) }));

// STORY-034: requestEmailChange sends a real email via notification.service.ts's
// sendTransactionalEmail — mocked here so these tests never touch the network.
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));

import { prisma } from "@/lib/db";
import {
  confirmEmailChange,
  requestAccountDeactivation,
  requestEmailChange,
  updateProfile,
} from "@/services/profile.service";
import { EmailInUseError, InvalidResetTokenError } from "@/services/auth.errors";

const EMAIL_PREFIX = "profile-svc-";
let sequence = 0;

function nextEmail(): string {
  sequence += 1;
  return `${EMAIL_PREFIX}${sequence}@test.com`;
}

async function makeUser(email = nextEmail()) {
  return prisma.user.create({ data: { email } });
}

describe("profile.service", () => {
  describe("updateProfile", () => {
    it("updates name/phone/dateOfBirth/image", async () => {
      const user = await makeUser();
      const updated = await updateProfile(user.id, { name: "Priya", phone: "+94 77 111 2222", dateOfBirth: new Date("1990-05-01"), image: "https://example.com/a.jpg" });
      expect(updated.name).toBe("Priya");
      expect(updated.phone).toBe("+94 77 111 2222");
      expect(updated.dateOfBirth?.toISOString().slice(0, 10)).toBe("1990-05-01");
      expect(updated.image).toBe("https://example.com/a.jpg");
    });
  });

  describe("email change lifecycle", () => {
    it("sets pendingEmail and confirms into email on a valid token, without touching email until confirmed", async () => {
      const user = await makeUser();
      const newEmail = nextEmail();

      await requestEmailChange(user.id, newEmail);
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      const afterRequest = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(afterRequest.pendingEmail).toBe(newEmail);
      expect(afterRequest.email).toBe(user.email);

      const [, , body] = mockEmailSend.mock.calls[0] as [string, string, string];
      const token = new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

      await confirmEmailChange(user.id, token);
      const afterConfirm = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(afterConfirm.email).toBe(newEmail);
      expect(afterConfirm.pendingEmail).toBeNull();
      expect(afterConfirm.emailVerified).not.toBeNull();
    });

    it("rejects requesting a change to an email already in use", async () => {
      const existing = await makeUser();
      const user = await makeUser();
      await expect(requestEmailChange(user.id, existing.email!)).rejects.toThrow(EmailInUseError);
    });

    it("rejects confirming with an invalid token", async () => {
      const user = await makeUser();
      await requestEmailChange(user.id, nextEmail());
      await expect(confirmEmailChange(user.id, "not-the-real-token")).rejects.toThrow(InvalidResetTokenError);
    });

    it("a concurrent password-reset request for the same user does not invalidate the email-verify token", async () => {
      const user = await makeUser();
      const newEmail = nextEmail();
      await requestEmailChange(user.id, newEmail);
      const [, , body] = mockEmailSend.mock.calls[mockEmailSend.mock.calls.length - 1] as [string, string, string];
      const token = new URL(body.match(/https?:\/\/\S+/)![0]).searchParams.get("token")!;

      const { requestPasswordReset } = await import("@/services/auth.service");
      await requestPasswordReset(user.email!);

      await expect(confirmEmailChange(user.id, token)).resolves.toBeUndefined();
    });
  });

  describe("requestAccountDeactivation", () => {
    it("flips status to DeactivationRequested and records the reason", async () => {
      const user = await makeUser();
      await requestAccountDeactivation(user.id, "No longer needed");
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(updated.status).toBe("DeactivationRequested");
      expect(updated.deactivationReason).toBe("No longer needed");
      expect(updated.deactivationRequestedAt).not.toBeNull();
    });
  });
});
