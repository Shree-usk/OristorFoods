// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn().mockResolvedValue({ status: "sent" }) }));

// Mirrors export-enquiry-service.test.ts's exact mocking shape — submitEnquiry
// sends a real email via notification.service.ts's sendTransactionalEmail.
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { getEnquiry, listEnquiries, submitEnquiry, updateStatus } from "@/services/contact-enquiry.service";
import { ContactEnquiryNotFoundError } from "@/services/contact-enquiry.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@contact-enquiry-svc-test.test";
const ROLE_KEY_PREFIX = "contact-enquiry-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Contact Enquiry Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "ContactEnquiries", action: "View" },
    { module: "ContactEnquiries", action: "Edit" },
  ]);
}

function defaultInput(overrides: object = {}) {
  sequence += 1;
  return {
    contactName: "Test Customer",
    contactEmail: `submitter-${sequence}@contact-enquiry-svc-test.test`,
    enquiryType: "General" as const,
    message: "Hello, I have a question.",
    honeypot: "",
    ...overrides,
  };
}

afterEach(async () => {
  mockEmailSend.mockClear();
  await prisma.contactEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
  await prisma.exportEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("contact-enquiry.service — honeypot and rate limit", () => {
  it("silently accepts without storing anything when the honeypot is filled", async () => {
    const input = defaultInput({ honeypot: "i-am-a-bot" });
    const result = await submitEnquiry(input);

    expect(result).toEqual({ submitted: true });
    const stored = await prisma.contactEnquiry.findFirst({ where: { contactEmail: input.contactEmail } });
    expect(stored).toBeNull();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it("silently caps after the rate limit, with the same response shape as success", async () => {
    const input = defaultInput();
    await submitEnquiry(input);
    await submitEnquiry(input);
    await submitEnquiry(input);
    const fourth = await submitEnquiry(input);

    expect(fourth).toEqual({ submitted: true });
    const count = await prisma.contactEnquiry.count({ where: { contactEmail: input.contactEmail } });
    expect(count).toBe(3);
  });
});

describe("contact-enquiry.service — General enquiry", () => {
  it("creates a ContactEnquiry row and sends both the confirmation and internal notification emails", async () => {
    const input = defaultInput({ enquiryType: "Product", message: "Is this product gluten-free?" });
    await submitEnquiry(input);

    const stored = await prisma.contactEnquiry.findFirst({ where: { contactEmail: input.contactEmail } });
    expect(stored).not.toBeNull();
    expect(stored?.enquiryType).toBe("Product");
    expect(mockEmailSend).toHaveBeenCalledTimes(2);
    const recipients = mockEmailSend.mock.calls.map((call) => call[0]);
    expect(recipients).toContain(input.contactEmail);
  });
});

describe("contact-enquiry.service — Export routing", () => {
  it("creates an ExportEnquiry row (not a ContactEnquiry) and still sends both emails", async () => {
    const input = defaultInput({ enquiryType: "Export", companyName: "Test Co", country: "USA", productInterest: "Spices" });
    await submitEnquiry(input);

    const contactRow = await prisma.contactEnquiry.findFirst({ where: { contactEmail: input.contactEmail } });
    expect(contactRow).toBeNull();
    const exportRow = await prisma.exportEnquiry.findFirst({ where: { contactEmail: input.contactEmail } });
    expect(exportRow).not.toBeNull();
    expect(exportRow?.companyName).toBe("Test Co");
    expect(mockEmailSend).toHaveBeenCalledTimes(2);
  });
});

describe("contact-enquiry.service — graceful email failure", () => {
  it("still reports a successful submission even when email sending throws", async () => {
    mockEmailSend.mockRejectedValueOnce(new Error("smtp down"));
    const input = defaultInput();

    const result = await submitEnquiry(input);

    expect(result).toEqual({ submitted: true });
    const stored = await prisma.contactEnquiry.findFirst({ where: { contactEmail: input.contactEmail } });
    expect(stored).not.toBeNull();
  });
});

describe("contact-enquiry.service — permission gating", () => {
  it("rejects an admin without ContactEnquiries:View from listing", async () => {
    const stranger = await makeAdmin([]);
    await expect(listEnquiries(stranger.id, {}, 1)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects a View-only admin from updating status", async () => {
    const admin = await makeFullAccessAdmin();
    const input = defaultInput();
    await submitEnquiry(input);
    const enquiry = await prisma.contactEnquiry.findFirstOrThrow({ where: { contactEmail: input.contactEmail } });

    const viewer = await makeAdmin([{ module: "ContactEnquiries", action: "View" }]);
    await expect(updateStatus(viewer.id, enquiry.id, "Responded")).rejects.toBeInstanceOf(PermissionDeniedError);

    const updated = await updateStatus(admin.id, enquiry.id, "Responded");
    expect(updated.status).toBe("Responded");
  });

  it("throws ContactEnquiryNotFoundError for a nonexistent id", async () => {
    const admin = await makeFullAccessAdmin();
    await expect(getEnquiry(admin.id, "nonexistent-id")).rejects.toBeInstanceOf(ContactEnquiryNotFoundError);
  });
});
