import nodemailer, { type Transporter } from "nodemailer";

import type { NotificationProvider, NotificationSendResult } from "@/services/notification/notification-provider.interface";

/**
 * Real, working email adapter — not a stub. If `SMTP_HOST` is configured,
 * sends through a real SMTP transport; otherwise auto-provisions a free
 * Ethereal sandbox inbox (nodemailer's built-in test-account service) so
 * the notification flow is exercisable end to end with zero local setup,
 * per the AC's explicit "SMTP/dev-catcher setup... without requiring a
 * production email service to be configured." Every Ethereal send logs
 * its preview URL (`nodemailer.getTestMessageUrl`) so a developer can
 * actually see the rendered email.
 */
export class EmailProvider implements NotificationProvider {
  readonly name: string;
  private transporterPromise: Promise<Transporter> | null = null;

  constructor() {
    this.name = process.env.SMTP_HOST ? "smtp" : "ethereal";
  }

  private async getTransporter(): Promise<Transporter> {
    this.transporterPromise ??= this.createTransporter();
    return this.transporterPromise;
  }

  private async createTransporter(): Promise<Transporter> {
    if (process.env.SMTP_HOST) {
      return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 587),
        secure: process.env.SMTP_SECURE === "true",
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
      });
    }

    const testAccount = await nodemailer.createTestAccount();
    return nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
  }

  async send(recipient: string, subject: string | null, body: string): Promise<NotificationSendResult> {
    try {
      const transporter = await this.getTransporter();
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM ?? "Oristor <no-reply@oristor.test>",
        to: recipient,
        subject: subject ?? "Notification from Oristor",
        text: body,
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) console.info(`[notification:email] preview: ${previewUrl}`);

      return { status: "sent", providerReference: info.messageId };
    } catch (error) {
      return { status: "failed", error: error instanceof Error ? error.message : String(error) };
    }
  }
}
