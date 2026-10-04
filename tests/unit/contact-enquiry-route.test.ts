// tests/unit/contact-enquiry-route.test.ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn().mockResolvedValue({ status: "sent" }) }));
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));
vi.mock("@/lib/admin-auth", () => ({ adminAuth: vi.fn() }));

import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

const { adminAuth } = await import("@/lib/admin-auth");
const { POST: submitEnquiryRoute } = await import("@/app/api/contact-enquiries/route");
const { GET: listRoute } = await import("@/app/api/admin/contact-enquiries/route");
const mockAdminAuth = adminAuth as unknown as Mock<() => Promise<Session | null>>;

const EMAIL_DOMAIN = "@contact-enquiry-route-test.test";
const ROLE_KEY_PREFIX = "contact-enquiry-route-test-role-";
let sequence = 0;

async function makeAdmin(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Contact Enquiry Route Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId: role.id } });
}

function sessionFor(adminId: string) {
  return { user: { id: adminId }, expires: new Date(Date.now() + 60_000).toISOString() };
}

beforeEach(() => {
  mockEmailSend.mockClear();
});

afterEach(async () => {
  await prisma.contactEnquiry.deleteMany({ where: { contactEmail: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  vi.clearAllMocks();
});

describe("POST /api/contact-enquiries", () => {
  it("returns a 200 happy-path result for a valid submission", async () => {
    sequence += 1;
    const response = await submitEnquiryRoute(
      new Request("http://localhost/api/contact-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName: "Jane", contactEmail: `jane-${sequence}${EMAIL_DOMAIN}`, enquiryType: "General", message: "Hello", honeypot: "" }),
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ submitted: true });
  });

  it("rejects invalid input with a 400", async () => {
    const response = await submitEnquiryRoute(
      new Request("http://localhost/api/contact-enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactName: "", contactEmail: "not-an-email", enquiryType: "General", message: "", honeypot: "" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});

describe("GET /api/admin/contact-enquiries", () => {
  it("returns 401 with no session", async () => {
    mockAdminAuth.mockResolvedValue(null);
    const response = await listRoute(new Request("http://localhost/api/admin/contact-enquiries"));
    expect(response.status).toBe(401);
  });

  it("returns 403 for an admin without ContactEnquiries:View", async () => {
    const stranger = await makeAdmin([]);
    mockAdminAuth.mockResolvedValue(sessionFor(stranger.id));
    const response = await listRoute(new Request("http://localhost/api/admin/contact-enquiries"));
    expect(response.status).toBe(403);
  });

  it("returns 200 for an admin with ContactEnquiries:View", async () => {
    const admin = await makeAdmin([{ module: "ContactEnquiries", action: "View" }]);
    mockAdminAuth.mockResolvedValue(sessionFor(admin.id));
    const response = await listRoute(new Request("http://localhost/api/admin/contact-enquiries"));
    expect(response.status).toBe(200);
  });
});
