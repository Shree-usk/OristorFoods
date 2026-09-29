/**
 * Provider-agnostic notification-channel contract (STORY-032), mirroring
 * payment.service.ts/payment-provider.interface.ts's exact shape. Which
 * concrete SMS/WhatsApp provider to use is an open business decision (no
 * provider is named in the blueprint) — the mock adapters are the only
 * implementation for those two channels by design, not a gap. Email has
 * a real, working adapter (Nodemailer, SMTP-or-Ethereal-sandbox) since
 * the AC explicitly asks for one.
 */

export interface NotificationSendResult {
  status: "sent" | "failed";
  providerReference?: string;
  error?: string;
}

export interface NotificationProvider {
  readonly name: string;
  /** `subject` is null for channels with no concept of one (SMS, WhatsApp). */
  send(recipient: string, subject: string | null, body: string): Promise<NotificationSendResult>;
}
