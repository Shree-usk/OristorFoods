// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";

const { mockEmailSend } = vi.hoisted(() => ({ mockEmailSend: vi.fn() }));

// EmailProvider genuinely dials out to Ethereal/SMTP — mocked so these
// tests never touch the network. SMS/WhatsApp mocks are already
// network-free and deterministic, so they run for real.
vi.mock("@/services/notification/email.provider", () => ({
  EmailProvider: class {
    name = "mock-email-for-test";
    send = mockEmailSend;
  },
}));

import { getOrCreateReferralCode } from "@/services/referral.service";
import { sendNotification } from "@/services/notification.service";

const EMAIL_PREFIX = "ntf-svc-";
let sequence = 0;

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `${EMAIL_PREFIX}${sequence}@test.com` } });
}

async function makeTemplate(templateKey: string, channel: "Email" | "SMS" | "WhatsApp", overrides: { subject?: string; body?: string } = {}) {
  return prisma.notificationTemplate.create({
    data: {
      templateKey,
      channel,
      subject: channel === "Email" ? (overrides.subject ?? "Subject {{name}}") : null,
      body: overrides.body ?? "Body {{name}} {{points}}",
    },
  });
}

beforeEach(() => {
  mockEmailSend.mockReset();
  mockEmailSend.mockResolvedValue({ status: "sent", providerReference: "mock-email-ref" });
});

afterEach(async () => {
  await prisma.notificationLog.deleteMany();
  await prisma.notificationPreference.deleteMany();
  await prisma.notificationTemplate.deleteMany();
  await prisma.referralCode.deleteMany();
  await prisma.user.deleteMany({ where: { email: { startsWith: EMAIL_PREFIX } } });
});

describe("sendNotification — template rendering", () => {
  it("renders the template's placeholders and calls the email provider with the result", async () => {
    const user = await makeUser();
    await makeTemplate("test.render", "Email", { subject: "Hi {{name}}", body: "You have {{points}} points" });

    await sendNotification({ userId: user.id, templateKey: "test.render", variables: { name: "Kamal", points: 50 }, triggeringEventId: "evt-1" });

    expect(mockEmailSend).toHaveBeenCalledWith(user.email, "Hi Kamal", "You have 50 points");
    const log = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, templateKey: "test.render" } });
    expect(log).toMatchObject({ status: "Sent", channel: "Email", recipient: user.email, providerReference: "mock-email-ref" });
  });

  it("sends a guest order-confirmation email via recipientOverrideEmail with no User/preference row involved", async () => {
    await makeTemplate("test.guest", "Email");

    await sendNotification({
      userId: null,
      recipientOverrideEmail: "guest@test.com",
      templateKey: "test.guest",
      variables: { name: "Guest", points: 0 },
      triggeringEventId: "evt-guest-1",
    });

    expect(mockEmailSend).toHaveBeenCalledWith("guest@test.com", expect.any(String), expect.any(String));
    const log = await prisma.notificationLog.findFirstOrThrow({ where: { recipient: "guest@test.com", templateKey: "test.guest" } });
    expect(log).toMatchObject({ status: "Sent", userId: null });
  });
});

describe("sendNotification — consent gating", () => {
  it("skips SMS/WhatsApp with SkippedNoConsent (no provider call) when the user has no preference row", async () => {
    const user = await makeUser();
    await makeTemplate("test.consent", "Email");
    await makeTemplate("test.consent", "SMS");
    await makeTemplate("test.consent", "WhatsApp");

    await sendNotification({ userId: user.id, templateKey: "test.consent", variables: {}, triggeringEventId: "evt-2" });

    const smsLog = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, channel: "SMS" } });
    const whatsappLog = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, channel: "WhatsApp" } });
    expect(smsLog.status).toBe("SkippedNoConsent");
    expect(whatsappLog.status).toBe("SkippedNoConsent");
    // Email is default-on and still sent.
    const emailLog = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, channel: "Email" } });
    expect(emailLog.status).toBe("Sent");
  });

  it("sends SMS when opted in with a phone on file", async () => {
    const user = await makeUser();
    await prisma.notificationPreference.create({ data: { userId: user.id, phone: "+94771234567", smsOptIn: true } });
    await makeTemplate("test.sms", "SMS", { body: "Points: {{points}}" });
    await makeTemplate("test.sms", "Email");

    await sendNotification({ userId: user.id, templateKey: "test.sms", variables: { points: 20 }, triggeringEventId: "evt-3" });

    const smsLog = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, channel: "SMS" } });
    expect(smsLog).toMatchObject({ status: "Sent", recipient: "+94771234567", provider: "mock-sms" });
  });

  it("does not gate email behind opt-in — sent even with no preference row at all", async () => {
    const user = await makeUser();
    await makeTemplate("test.email-default", "Email");

    await sendNotification({ userId: user.id, templateKey: "test.email-default", variables: {}, triggeringEventId: "evt-4" });

    const log = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, channel: "Email" } });
    expect(log.status).toBe("Sent");
  });
});

describe("sendNotification — duplicate-send guard", () => {
  it("never sends the same notification twice for the same triggeringEventId+templateKey+recipient", async () => {
    const user = await makeUser();
    await makeTemplate("test.dedup", "Email");

    await sendNotification({ userId: user.id, templateKey: "test.dedup", variables: {}, triggeringEventId: "evt-5" });
    await sendNotification({ userId: user.id, templateKey: "test.dedup", variables: {}, triggeringEventId: "evt-5" });

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    // One row per channel (Email Sent + SMS/WhatsApp SkippedNoConsent, since
    // this user has no preference row) — the assertion is that the SECOND
    // sendNotification call added no additional rows, not that only one
    // channel was ever attempted.
    const logs = await prisma.notificationLog.findMany({ where: { userId: user.id, templateKey: "test.dedup" } });
    expect(logs).toHaveLength(3);
  });

  it("a different triggeringEventId is a genuinely new send", async () => {
    const user = await makeUser();
    await makeTemplate("test.dedup2", "Email");

    await sendNotification({ userId: user.id, templateKey: "test.dedup2", variables: {}, triggeringEventId: "evt-6a" });
    await sendNotification({ userId: user.id, templateKey: "test.dedup2", variables: {}, triggeringEventId: "evt-6b" });

    expect(mockEmailSend).toHaveBeenCalledTimes(2);
  });
});

describe("sendNotification — failure isolation", () => {
  it("logs a provider failure as Failed without throwing back to the caller", async () => {
    const user = await makeUser();
    await makeTemplate("test.fail", "Email");
    mockEmailSend.mockResolvedValueOnce({ status: "failed", error: "SMTP connection refused" });

    await expect(
      sendNotification({ userId: user.id, templateKey: "test.fail", variables: {}, triggeringEventId: "evt-7" }),
    ).resolves.toBeUndefined();

    const log = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, templateKey: "test.fail", channel: "Email" } });
    expect(log).toMatchObject({ status: "Failed", error: "SMTP connection refused" });
  });

  it("logs Failed (not a throw) when no active template is configured for a channel", async () => {
    const user = await makeUser();
    // No template created at all for this key.

    await expect(
      sendNotification({ userId: user.id, templateKey: "test.no-template", variables: {}, triggeringEventId: "evt-8" }),
    ).resolves.toBeUndefined();

    const log = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, templateKey: "test.no-template", channel: "Email" } });
    expect(log.status).toBe("Failed");
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it("an inactive template is treated the same as a missing one", async () => {
    const user = await makeUser();
    await prisma.notificationTemplate.create({ data: { templateKey: "test.inactive", channel: "Email", body: "x", isActive: false } });

    await sendNotification({ userId: user.id, templateKey: "test.inactive", variables: {}, triggeringEventId: "evt-9" });

    expect(mockEmailSend).not.toHaveBeenCalled();
    const log = await prisma.notificationLog.findFirstOrThrow({ where: { userId: user.id, templateKey: "test.inactive" } });
    expect(log.status).toBe("Failed");
  });
});

// Sanity that referral.service.ts (a real caller of sendNotification) still
// works with EmailProvider mocked — confirms the mock doesn't leak into an
// unrelated module import graph.
describe("cross-module sanity", () => {
  it("getOrCreateReferralCode still works with the email provider mocked", async () => {
    const user = await makeUser();
    const code = await getOrCreateReferralCode(user.id);
    expect(code).toHaveLength(8);
  });
});
