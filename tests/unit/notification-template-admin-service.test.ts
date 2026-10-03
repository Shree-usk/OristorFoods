// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { PermissionDeniedError } from "@/services/permission.errors";
import { NotificationTemplateNotFoundError } from "@/services/notification-template-admin.errors";
import { extractMergeFields, listTemplatesForAdmin, previewTemplate, updateTemplate } from "@/services/notification-template-admin.service";

const EMAIL_DOMAIN = "@notification-template-admin-svc-test.test";
const ROLE_KEY_PREFIX = "notification-template-admin-svc-test-role-";
const TEMPLATE_KEY_PREFIX = "notification-template-admin-svc-test-key-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Notification Template Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

async function makeTemplate() {
  sequence += 1;
  return prisma.notificationTemplate.create({
    data: { templateKey: `${TEMPLATE_KEY_PREFIX}${sequence}`, channel: "Email", subject: "Original subject", body: "Original body for {{customerName}}." },
  });
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.notificationTemplate.deleteMany({ where: { templateKey: { startsWith: TEMPLATE_KEY_PREFIX } } });
});

describe("notification-template-admin.service", () => {
  it("lists templates for a View-permitted admin and denies a stranger", async () => {
    const template = await makeTemplate();
    const viewer = await makeAdmin([{ module: "SystemSettings", action: "View" }]);
    const templates = await listTemplatesForAdmin(viewer.id);
    expect(Array.isArray(templates)).toBe(true);
    expect(templates.some((t) => t.id === template.id)).toBe(true);

    const stranger = await makeAdmin([]);
    await expect(listTemplatesForAdmin(stranger.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("updates an existing template and writes an audit log entry", async () => {
    const existing = await makeTemplate();
    const editor = await makeAdmin([
      { module: "SystemSettings", action: "View" },
      { module: "SystemSettings", action: "Edit" },
    ]);

    const updated = await updateTemplate(editor.id, existing.id, { body: "Hello {{customerName}}, your order {{orderId}} has shipped." });
    expect(updated.body).toBe("Hello {{customerName}}, your order {{orderId}} has shipped.");

    const logCount = await prisma.auditLog.count({ where: { actorId: editor.id, action: "notification_template_updated", targetId: existing.id } });
    expect(logCount).toBe(1);
  });

  it("throws NotificationTemplateNotFoundError for an unknown id", async () => {
    const editor = await makeAdmin([{ module: "SystemSettings", action: "Edit" }]);
    await expect(updateTemplate(editor.id, "not-a-real-id", { body: "x" })).rejects.toBeInstanceOf(NotificationTemplateNotFoundError);
  });

  it("extractMergeFields dedupes and preserves order of first appearance", () => {
    expect(extractMergeFields("Hi {{customerName}}, order {{orderId}} for {{customerName}} is ready.")).toEqual(["customerName", "orderId"]);
    expect(extractMergeFields("No placeholders here.")).toEqual([]);
  });

  it("previewTemplate substitutes known variables and leaves unknown placeholders untouched", () => {
    expect(previewTemplate("Hi {{customerName}}, your code is {{otpCode}}.", { customerName: "Nadeesha" })).toBe("Hi Nadeesha, your code is {{otpCode}}.");
  });
});
