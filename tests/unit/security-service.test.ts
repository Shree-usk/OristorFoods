// @vitest-environment node
import { describe, expect, it } from "vitest";

import bcrypt from "bcryptjs";

import { prisma } from "@/lib/db";
import { getPasswordVersion, registerCustomer, verifyCredentials } from "@/services/auth.service";
import { changePassword, logOutAllDevices } from "@/services/security.service";
import { IncorrectCurrentPasswordError } from "@/services/security.errors";
import type { RegisterInput } from "@/validation/auth.schema";

const EMAIL_PREFIX = "security-svc-";
let sequence = 0;

function registerInput(): RegisterInput {
  sequence += 1;
  return { name: "Test", email: `${EMAIL_PREFIX}${sequence}@test.com`, password: "Password123", marketingOptIn: false };
}

const noopRequest = () => new Request("http://localhost/api/auth/register");

describe("security.service", () => {
  describe("changePassword", () => {
    it("changes the password and bumps the session version, invalidating the old password", async () => {
      const input = registerInput();
      const { userId } = await registerCustomer(input, noopRequest());
      const versionBefore = await getPasswordVersion(userId);

      await changePassword(userId, input.password, "NewPassword456");

      expect(await verifyCredentials(input.email, input.password)).toBeNull();
      expect(await verifyCredentials(input.email, "NewPassword456")).not.toBeNull();
      expect(await getPasswordVersion(userId)).not.toBe(versionBefore);
    });

    it("rejects an incorrect current password without changing anything", async () => {
      const input = registerInput();
      const { userId } = await registerCustomer(input, noopRequest());

      await expect(changePassword(userId, "WrongCurrentPassword1", "NewPassword456")).rejects.toThrow(IncorrectCurrentPasswordError);
      expect(await verifyCredentials(input.email, input.password)).not.toBeNull();
    });
  });

  describe("logOutAllDevices", () => {
    it("bumps the session version without touching the password hash", async () => {
      const input = registerInput();
      const { userId } = await registerCustomer(input, noopRequest());
      const before = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const versionBefore = await getPasswordVersion(userId);

      await logOutAllDevices(userId);

      const after = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
      expect(after.passwordHash).toBe(before.passwordHash);
      expect(await bcrypt.compare(input.password, after.passwordHash!)).toBe(true);
      expect(await getPasswordVersion(userId)).not.toBe(versionBefore);
    });
  });
});
