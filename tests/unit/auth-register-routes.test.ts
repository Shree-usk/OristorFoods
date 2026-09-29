// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { POST as postRegister } from "@/app/api/auth/register/route";
import { REFERRAL_COOKIE_NAME } from "@/lib/api/referral-cookie";
import { signReferralToken } from "@/lib/referral-token";
import { getOrCreateReferralCode } from "@/services/referral.service";

const EMAIL_PREFIX = "reg-route-";

async function cleanupReferralTables() {
  await prisma.rewardTransaction.deleteMany();
  await prisma.rewardAccount.deleteMany();
  await prisma.referralAttribution.deleteMany();
  await prisma.referralCode.deleteMany();
}

afterEach(async () => {
  await cleanupReferralTables();
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

// STORY-033 added a required `marketingOptIn` field to the register payload — defaulted here so existing call sites don't need to repeat it.
function registerRequest(body: Record<string, unknown>, cookieValue?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (cookieValue) headers.set("cookie", `${REFERRAL_COOKIE_NAME}=${cookieValue}`);
  return new Request("http://localhost/api/auth/register", { method: "POST", headers, body: JSON.stringify({ marketingOptIn: false, ...body }) });
}

describe("POST /api/auth/register", () => {
  it("400s a malformed body", async () => {
    const response = await postRegister(registerRequest({ email: "not-an-email", password: "short" }));
    expect(response.status).toBe(400);
  });

  it("creates a user and a referral code on the happy path", async () => {
    const response = await postRegister(registerRequest({ email: `${EMAIL_PREFIX}1@test.com`, password: "password123" }));
    expect(response.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: `${EMAIL_PREFIX}1@test.com` } });
    expect(user.passwordHash).toBeTruthy();

    const code = await prisma.referralCode.findUnique({ where: { userId: user.id } });
    expect(code).not.toBeNull();
  });

  it("409s a duplicate email", async () => {
    await postRegister(registerRequest({ email: `${EMAIL_PREFIX}2@test.com`, password: "password123" }));
    const second = await postRegister(registerRequest({ email: `${EMAIL_PREFIX}2@test.com`, password: "password456" }));
    expect(second.status).toBe(409);
  });

  it("records a referral attribution when a valid referral cookie is present", async () => {
    const referrer = await prisma.user.create({ data: { email: `${EMAIL_PREFIX}referrer@test.com` } });
    const code = await getOrCreateReferralCode(referrer.id);
    const cookieValue = await signReferralToken(code);

    const response = await postRegister(registerRequest({ email: `${EMAIL_PREFIX}3@test.com`, password: "password123" }, cookieValue));
    expect(response.status).toBe(201);

    const referred = await prisma.user.findUniqueOrThrow({ where: { email: `${EMAIL_PREFIX}3@test.com` } });
    const attribution = await prisma.referralAttribution.findUnique({ where: { referredUserId: referred.id } });
    expect(attribution).toMatchObject({ referrerUserId: referrer.id, status: "Registered" });

    // The response clears the cookie so a second, unrelated registration in the same browser isn't mis-attributed.
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain(`${REFERRAL_COOKIE_NAME}=;`);
  });

  it("does not attribute and does not error for an unknown referral code", async () => {
    const cookieValue = await signReferralToken("NOTAREALCODE");
    const response = await postRegister(registerRequest({ email: `${EMAIL_PREFIX}4@test.com`, password: "password123" }, cookieValue));
    expect(response.status).toBe(201);

    const user = await prisma.user.findUniqueOrThrow({ where: { email: `${EMAIL_PREFIX}4@test.com` } });
    expect(await prisma.referralAttribution.findUnique({ where: { referredUserId: user.id } })).toBeNull();
  });
});
