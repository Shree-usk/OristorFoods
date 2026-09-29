import { randomUUID } from "node:crypto";

import type { NotificationProvider, NotificationSendResult } from "@/services/notification/notification-provider.interface";

/**
 * Simulates an SMS gateway for local dev, tests, and demos — no external
 * network, mirroring mock-payment.provider.ts's shape. No SMS provider is
 * named in the blueprint; concrete integration (e.g. Twilio) is a
 * follow-up story once one is selected. Always succeeds for a non-empty
 * recipient — there's no external system to simulate a decline against.
 */
export class MockSmsProvider implements NotificationProvider {
  readonly name = "mock-sms";

  async send(recipient: string, _subject: string | null, body: string): Promise<NotificationSendResult> {
    if (!recipient.trim()) return { status: "failed", error: "No phone number on file." };
    console.info(`[notification:sms] to=${recipient} body=${body}`);
    return { status: "sent", providerReference: `mock_sms_${randomUUID()}` };
  }
}
