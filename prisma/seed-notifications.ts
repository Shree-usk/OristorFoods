import { prisma } from "../src/lib/db";

/**
 * Notification template seed (STORY-032). Real, working (if plain) copy
 * for all 6 notification types × 3 channels — this is exactly the
 * content STORY-054's future admin authoring UI will edit, per
 * CLAUDE.md's Admin Console Principle. Seeded now so the feature works
 * end to end today, rather than shipping trigger/delivery plumbing with
 * nowhere for message copy to live.
 */
export async function seedNotificationTemplates() {
  const templates = [
    {
      templateKey: "order.confirmed",
      email: {
        subject: "Your Oristor order {{orderNumber}} is confirmed",
        body: "Thank you for your order! Order {{orderNumber}} for {{currency}} {{grandTotal}} has been confirmed and is being prepared.",
      },
      sms: "Oristor: Order {{orderNumber}} confirmed. Total {{currency}} {{grandTotal}}. Thank you for shopping with us!",
      whatsapp: "Your Oristor order *{{orderNumber}}* is confirmed. Total: {{currency}} {{grandTotal}}. We'll let you know when it ships.",
    },
    {
      templateKey: "order.dispatched",
      email: {
        subject: "Your Oristor order {{orderNumber}} has shipped",
        body: "Good news — order {{orderNumber}} is on its way to you.",
      },
      sms: "Oristor: Order {{orderNumber}} has shipped and is on its way.",
      whatsapp: "Your Oristor order *{{orderNumber}}* has shipped and is on its way to you.",
    },
    {
      templateKey: "order.delivered",
      email: {
        subject: "Your Oristor order {{orderNumber}} has been delivered",
        body: "Order {{orderNumber}} has been delivered. We hope you enjoy it — thank you for choosing Oristor.",
      },
      sms: "Oristor: Order {{orderNumber}} has been delivered. Enjoy!",
      whatsapp: "Your Oristor order *{{orderNumber}}* has been delivered. Enjoy, and thank you for shopping with us!",
    },
    {
      templateKey: "order.cancelled",
      email: {
        subject: "Your Oristor order {{orderNumber}} was cancelled",
        body: "Order {{orderNumber}} has been cancelled. If you paid for this order, a refund is being processed.",
      },
      sms: "Oristor: Order {{orderNumber}} was cancelled. Any payment will be refunded.",
      whatsapp: "Your Oristor order *{{orderNumber}}* was cancelled. Any payment made will be refunded.",
    },
    {
      templateKey: "rewards.points_earned",
      email: {
        subject: "You earned {{points}} Oristor reward points",
        body: "You just earned {{points}} reward points. Check your balance and redeem them on your next order.",
      },
      sms: "Oristor: You earned {{points}} reward points!",
      whatsapp: "You just earned *{{points}}* Oristor reward points! Redeem them on your next order.",
    },
    {
      templateKey: "referral.qualified",
      email: {
        subject: "Your Oristor referral just earned you {{points}} points",
        body: "A friend you referred just completed a qualifying order — you've been credited {{points}} reward points. Thanks for spreading the word!",
      },
      sms: "Oristor: Your referral qualified! You earned {{points}} reward points.",
      whatsapp: "Your referral just qualified — you earned *{{points}}* Oristor reward points! Thanks for sharing.",
    },
  ];

  for (const template of templates) {
    await prisma.notificationTemplate.create({
      data: { templateKey: template.templateKey, channel: "Email", subject: template.email.subject, body: template.email.body },
    });
    await prisma.notificationTemplate.create({
      data: { templateKey: template.templateKey, channel: "SMS", body: template.sms },
    });
    await prisma.notificationTemplate.create({
      data: { templateKey: template.templateKey, channel: "WhatsApp", body: template.whatsapp },
    });
  }

  return { templateTypes: templates.length, rows: templates.length * 3 };
}
