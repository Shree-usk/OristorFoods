// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import type { Session } from "next-auth";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GET as getCode } from "@/app/api/referral/code/route";
import { GET as getStatus } from "@/app/api/referral/status/route";

const mockAuth = auth as unknown as Mock<() => Promise<Session | null>>;

const EMAIL_PREFIX = "rfl-route-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

function sessionFor(userId: string): Session {
  return { user: { id: userId }, expires: new Date(Date.now() + 60_000).toISOString() } as Session;
}

beforeEach(() => {
  mockAuth.mockReset();
  mockAuth.mockResolvedValue(null);
});

afterEach(async () => {
  await prisma.referralAttribution.deleteMany();
  await prisma.referralCode.deleteMany();
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("GET /api/referral/code", () => {
  it("401s for a guest", async () => {
    const response = await getCode();
    expect(response.status).toBe(401);
  });

  it("lazily generates and returns a code for an authenticated customer", async () => {
    const user = await makeUser();
    mockAuth.mockResolvedValue(sessionFor(user.id));

    const response = await getCode();
    const body = (await response.json()) as { code: string; link: string };
    expect(response.status).toBe(200);
    expect(body.code).toHaveLength(8);
    expect(body.link).toBe(`/?ref=${body.code}`);

    // Returns the same code on a second call.
    const second = await getCode();
    expect((await second.json() as { code: string }).code).toBe(body.code);
  });
});

describe("GET /api/referral/status", () => {
  it("401s for a guest", async () => {
    const response = await getStatus();
    expect(response.status).toBe(401);
  });

  it("returns this customer's referrals", async () => {
    const referrer = await makeUser();
    const referred = await makeUser();
    await prisma.referralAttribution.create({ data: { referrerUserId: referrer.id, referredUserId: referred.id, status: "Registered" } });
    mockAuth.mockResolvedValue(sessionFor(referrer.id));

    const response = await getStatus();
    const body = (await response.json()) as { referrals: Array<{ status: string }> };
    expect(response.status).toBe(200);
    expect(body.referrals).toHaveLength(1);
    expect(body.referrals[0].status).toBe("Registered");
  });
});
