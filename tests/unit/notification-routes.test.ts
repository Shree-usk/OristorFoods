// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as getPreferences, POST as postPreferences } from "@/app/api/notifications/preferences/route";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const EMAIL_PREFIX = "ntf-route-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

function sessionFor(userId: string): Session {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() } as Session;
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/notifications/preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.notificationPreference.deleteMany();
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("GET /api/notifications/preferences", () => {
  it("401s for a guest", async () => {
    const response = await getPreferences();
    expect(response.status).toBe(401);
  });

  it("returns sensible defaults when no preference row exists yet", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await getPreferences();
    const body = (await response.json()) as { phone: string | null; emailOptIn: boolean; smsOptIn: boolean; whatsappOptIn: boolean };
    expect(response.status).toBe(200);
    expect(body).toEqual({ phone: null, emailOptIn: true, smsOptIn: false, whatsappOptIn: false });
  });
});

describe("POST /api/notifications/preferences", () => {
  it("401s for a guest", async () => {
    const response = await postPreferences(postRequest({ smsOptIn: true }));
    expect(response.status).toBe(401);
  });

  it("400s an invalid body", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await postPreferences(postRequest({ phone: 12345 }));
    expect(response.status).toBe(400);
  });

  it("upserts the caller's preferences", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await postPreferences(postRequest({ phone: "+94771234567", smsOptIn: true, whatsappOptIn: true }));
    const body = (await response.json()) as { phone: string; smsOptIn: boolean; whatsappOptIn: boolean };
    expect(response.status).toBe(200);
    expect(body).toMatchObject({ phone: "+94771234567", smsOptIn: true, whatsappOptIn: true });

    const row = await prisma.notificationPreference.findUniqueOrThrow({ where: { userId: user.id } });
    expect(row.phone).toBe("+94771234567");
  });

  it("a second update merges rather than resetting untouched fields", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    await postPreferences(postRequest({ phone: "+94771234567", smsOptIn: true }));
    const second = await postPreferences(postRequest({ whatsappOptIn: true }));
    const body = (await second.json()) as { phone: string; smsOptIn: boolean; whatsappOptIn: boolean };
    expect(body).toMatchObject({ phone: "+94771234567", smsOptIn: true, whatsappOptIn: true });
  });
});
