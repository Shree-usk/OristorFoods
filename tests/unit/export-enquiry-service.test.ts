// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn().mockResolvedValue({ status: "sent" }) }));

// Mirrors tests/unit/admin-user-admin-service.test.ts's exact mocking shape — replyToEnquiry and the Distributor
// Account conversion's requestPasswordReset both send a real email via notification.service.ts's sendTransactionalEmail.
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  addNote,
  assignEnquiry,
  convertToDistributorAccount,
  getEnquiryActivity,
  listAssignableAdmins,
  listDistributorAccounts,
  listEnquiries,
  replyToEnquiry,
  submitEnquiry,
  updateEnquiryStatus,
} from "@/services/export-enquiry.service";
import { EnquiryNotWonError, InvalidStatusTransitionError } from "@/services/export-enquiry.errors";
import { PermissionDeniedError } from "@/services/permission.errors";

const EMAIL_DOMAIN = "@export-enquiry-svc-test.test";
const ROLE_KEY_PREFIX = "export-enquiry-svc-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Export Enquiry Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function makeFullAccessAdmin() {
  return makeAdmin([
    { module: "ExportPortal", action: "View" },
    { module: "ExportPortal", action: "Edit" },
    { module: "ExportPortal", action: "Approve" },
  ]);
}

function nextEmail(prefix: string): string {
  sequence += 1;
  return `${prefix}-${sequence}${EMAIL_DOMAIN}`;
}

async function makeEnquiry(overrides: Partial<Parameters<typeof prisma.exportEnquiry.create>[0]["data"]> = {}) {
  sequence += 1;
  return prisma.exportEnquiry.create({
    data: {
      companyName: "Test Export Co",
      contactName: "Jane Buyer",
      contactEmail: nextEmail("enquirer"),
      country: "United States",
      productsOfInterest: "Kithul jaggery",
      message: "We'd like to discuss a bulk order.",
      ...overrides,
    },
  });
}

afterEach(async () => {
  mockEmailSend.mockClear();
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.distributorAccount.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.exportEnquiryNote.deleteMany({ where: { enquiry: { contactEmail: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.exportEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("export-enquiry.service — submitEnquiry (public)", () => {
  it("creates an enquiry with status New", async () => {
    const email = nextEmail("public");
    const enquiry = await submitEnquiry({
      companyName: "Public Co",
      contactName: "Public Buyer",
      contactEmail: email,
      country: "Germany",
      productsOfInterest: "Spice blends",
      message: "Interested in distribution.",
    });

    expect(enquiry?.status).toBe("New");
    expect(enquiry?.contactEmail).toBe(email);
  });

  it("rate-limits repeated submissions from the same email", async () => {
    const email = nextEmail("ratelimited");
    const input = { companyName: "RL Co", contactName: "RL", contactEmail: email, country: "UK", productsOfInterest: "Tea", message: "m" };

    await submitEnquiry(input);
    await submitEnquiry(input);
    await submitEnquiry(input);
    const fourth = await submitEnquiry(input);

    expect(fourth).toBeUndefined();
    const count = await prisma.exportEnquiry.count({ where: { contactEmail: email } });
    expect(count).toBe(3);
  });
});

describe("export-enquiry.service — permission gating", () => {
  it("rejects an admin without ExportPortal:View from listing or viewing", async () => {
    const stranger = await makeAdmin([]);
    await expect(listEnquiries(stranger.id, {}, 1)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an admin with only View from changing status", async () => {
    const viewer = await makeAdmin([{ module: "ExportPortal", action: "View" }]);
    const enquiry = await makeEnquiry();
    await expect(updateEnquiryStatus(viewer.id, enquiry.id, "InDiscussion")).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an admin with only Edit from converting to a Distributor Account", async () => {
    const editor = await makeAdmin([{ module: "ExportPortal", action: "Edit" }]);
    const enquiry = await makeEnquiry({ status: "Won" });
    await expect(convertToDistributorAccount(editor.id, enquiry.id, { region: "EU" })).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("listAssignableAdmins is gated on ExportPortal:Edit, not UsersRolesAudit:View", async () => {
    const editor = await makeAdmin([{ module: "ExportPortal", action: "Edit" }]);
    const admins = await listAssignableAdmins(editor.id);
    expect(admins.some((a) => a.id === editor.id)).toBe(true);

    const viewer = await makeAdmin([{ module: "ExportPortal", action: "View" }]);
    await expect(listAssignableAdmins(viewer.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("export-enquiry.service — status transitions", () => {
  it("allows the full New -> InDiscussion -> Quoted -> Won progression", async () => {
    const admin = await makeFullAccessAdmin();
    const enquiry = await makeEnquiry();

    await updateEnquiryStatus(admin.id, enquiry.id, "InDiscussion");
    await updateEnquiryStatus(admin.id, enquiry.id, "Quoted");
    const won = await updateEnquiryStatus(admin.id, enquiry.id, "Won");
    expect(won.status).toBe("Won");
  });

  it("allows Lost from New, InDiscussion, and Quoted", async () => {
    const admin = await makeFullAccessAdmin();

    const fromNew = await makeEnquiry();
    const lostFromNew = await updateEnquiryStatus(admin.id, fromNew.id, "Lost");
    expect(lostFromNew.status).toBe("Lost");

    const fromDiscussion = await makeEnquiry();
    await updateEnquiryStatus(admin.id, fromDiscussion.id, "InDiscussion");
    const lostFromDiscussion = await updateEnquiryStatus(admin.id, fromDiscussion.id, "Lost");
    expect(lostFromDiscussion.status).toBe("Lost");
  });

  it("rejects Lost from Won and rejects skipping a step", async () => {
    const admin = await makeFullAccessAdmin();
    const won = await makeEnquiry({ status: "Won" });
    await expect(updateEnquiryStatus(admin.id, won.id, "Lost")).rejects.toBeInstanceOf(InvalidStatusTransitionError);

    const fresh = await makeEnquiry();
    await expect(updateEnquiryStatus(admin.id, fresh.id, "Won")).rejects.toBeInstanceOf(InvalidStatusTransitionError);
  });

  it("logs status changes, assignment, notes, and replies to the audit log", async () => {
    const admin = await makeFullAccessAdmin();
    const enquiry = await makeEnquiry();

    await updateEnquiryStatus(admin.id, enquiry.id, "InDiscussion");
    await assignEnquiry(admin.id, enquiry.id, admin.id);
    await addNote(admin.id, enquiry.id, "Called them back.");
    await replyToEnquiry(admin.id, enquiry.id, "Re: your enquiry", "Thanks for reaching out.");

    const activity = await getEnquiryActivity(admin.id, enquiry.id);
    const actions = activity.map((entry) => entry.action);
    expect(actions).toEqual(
      expect.arrayContaining(["export_enquiry_status_changed", "export_enquiry_assigned", "export_enquiry_note_added", "export_enquiry_replied"]),
    );
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });
});

describe("export-enquiry.service — convertToDistributorAccount", () => {
  it("rejects conversion unless the enquiry is Won", async () => {
    const admin = await makeFullAccessAdmin();
    const enquiry = await makeEnquiry();
    await expect(convertToDistributorAccount(admin.id, enquiry.id, { region: "APAC" })).rejects.toBeInstanceOf(EnquiryNotWonError);
  });

  it("creates a new User with customerGroup Distributor and sends a password-reset email when none existed", async () => {
    const admin = await makeFullAccessAdmin();
    const email = nextEmail("newdistributor");
    const enquiry = await makeEnquiry({ status: "Won", contactEmail: email });

    const account = await convertToDistributorAccount(admin.id, enquiry.id, { region: "APAC" });

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.customerGroup).toBe("Distributor");
    expect(account.userId).toBe(user?.id);
    // One call for the conversion's own password-reset email — replyToEnquiry is never invoked here.
    expect(mockEmailSend).toHaveBeenCalledTimes(1);

    const accounts = await listDistributorAccounts(admin.id);
    expect(accounts.some((a) => a.id === account.id)).toBe(true);
  });

  it("links an existing User and upgrades their customerGroup, without sending a new email", async () => {
    const admin = await makeFullAccessAdmin();
    const email = nextEmail("existingcustomer");
    const existingUser = await prisma.user.create({ data: { email, name: "Existing Customer", customerGroup: "Retail" } });
    const enquiry = await makeEnquiry({ status: "Won", contactEmail: email });

    const account = await convertToDistributorAccount(admin.id, enquiry.id, { region: "EU" });

    expect(account.userId).toBe(existingUser.id);
    const updated = await prisma.user.findUnique({ where: { id: existingUser.id } });
    expect(updated?.customerGroup).toBe("Distributor");
    expect(mockEmailSend).not.toHaveBeenCalled();
  });
});
