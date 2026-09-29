import { randomUUID } from "node:crypto";

import type { NotificationProvider, NotificationSendResult } from "@/services/notification/notification-provider.interface";

/**
 * Simulates a WhatsApp Business API integration for local dev, tests, and
 * demos — no external network, mirroring mock-payment.provider.ts's
 * shape. No provider is named in the blueprint; concrete integration is
 * a follow-up story once one is selected.
 */
export class MockWhatsappProvider implements NotificationProvider {
  readonly name = "mock-whatsapp";

  async send(recipient: string, _subject: string | null, body: string): Promise<NotificationSendResult> {
    if (!recipient.trim()) return { status: "failed", error: "No phone number on file." };
    console.info(`[notification:whatsapp] to=${recipient} body=${body}`);
    return { status: "sent", providerReference: `mock_whatsapp_${randomUUID()}` };
  }
}
