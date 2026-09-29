import { Prisma, type NotificationChannel } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import * as notificationRepository from "@/repositories/notification.repository";
import type { CreateLogInput } from "@/repositories/notification.repository";
import * as orderRepository from "@/repositories/order.repository";
import { EmailProvider } from "@/services/notification/email.provider";
import type { NotificationProvider } from "@/services/notification/notification-provider.interface";
import { MockSmsProvider } from "@/services/notification/sms.provider";
import { MockWhatsappProvider } from "@/services/notification/whatsapp.provider";
import { NotificationProviderUnconfiguredError } from "@/services/notification.errors";
import type { OrderEventConsumer, OrderEventType } from "@/services/order-integration.service";

/**
 * Transactional (event-triggered, one-to-one) notifications only — bulk
 * marketing campaigns are STORY-050's. Two different trigger mechanisms,
 * chosen per how the underlying fact is actually observed:
 *
 * - Order-lifecycle notifications (confirmed/dispatched/delivered/
 *   cancelled) are genuinely event-driven: notificationsConsumer below
 *   subscribes to order-integration.service.ts's fan-out, exactly like
 *   STORY-030/031's rewardsConsumer/referralConsumer.
 * - Points-earned and referral-qualified are NOT: rewards.service.ts's
 *   creditPointsForConfirmedOrder and referral.service.ts's
 *   handleQualifyingCheck already run inside their OWN order-event
 *   consumers, and only they know whether a credit was a genuine new one
 *   or an idempotent no-op replay — a bare order.confirmed payload can't
 *   tell a third, independent consumer that. So sendNotification is
 *   called directly from those functions' success paths instead. See
 *   docs/architecture-decisions.md.
 */

const providers: Partial<Record<NotificationChannel, NotificationProvider>> = {};

/** Mirrors payment.service.ts::getActiveProvider exactly — the ONE place a concrete provider may be constructed. Cached per channel (Ethereal's sandbox account is expensive to re-provision). */
function getProviderForChannel(channel: NotificationChannel): NotificationProvider {
  const cached = providers[channel];
  if (cached) return cached;

  const provider = createProviderForChannel(channel);
  providers[channel] = provider;
  return provider;
}

function createProviderForChannel(channel: NotificationChannel): NotificationProvider {
  if (channel === "Email") return new EmailProvider();

  const envVar = channel === "SMS" ? "SMS_PROVIDER" : "WHATSAPP_PROVIDER";
  const configured = process.env[envVar] ?? "mock";
  if (configured !== "mock") throw new NotificationProviderUnconfiguredError(configured);
  return channel === "SMS" ? new MockSmsProvider() : new MockWhatsappProvider();
}

function isUniqueConstraintViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** Plain `{{key}}` substitution — no templating engine needed for this story's scope. */
function renderTemplate(body: string, variables: Record<string, string | number>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in variables ? String(variables[key]) : match));
}

interface ChannelTarget {
  channel: NotificationChannel;
  /** Null = no valid, opted-in contact method — the channel is skipped, never attempted. */
  recipient: string | null;
}

/**
 * Email is default-on for a registered user (not gated by an opt-in
 * flag) and always attempted for a guest order's own email — transactional
 * receipts aren't subject to marketing opt-out, and a guest has no
 * preference row to consult. SMS/WhatsApp require both an explicit
 * opt-in AND a phone on file; a guest can never receive either — there's
 * no mechanism to collect consent/a phone number during guest checkout.
 */
async function resolveChannelTargets(userId: string | null, recipientOverrideEmail: string | null | undefined): Promise<ChannelTarget[]> {
  if (!userId) {
    // A guest can never receive SMS/WhatsApp (no mechanism to collect
    // consent/a phone number during guest checkout) — still returned as
    // targets (recipient: null) rather than omitted, so a SkippedNoConsent
    // row records why, matching how the AC wants that outcome visible.
    return [
      { channel: "Email", recipient: recipientOverrideEmail ?? null },
      { channel: "SMS", recipient: null },
      { channel: "WhatsApp", recipient: null },
    ];
  }

  const [user, preference] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
    notificationRepository.findPreferenceByUserId(userId),
  ]);

  const emailOptIn = preference?.emailOptIn ?? true;
  return [
    { channel: "Email", recipient: emailOptIn ? (user?.email ?? null) : null },
    { channel: "SMS", recipient: preference?.smsOptIn && preference.phone ? preference.phone : null },
    { channel: "WhatsApp", recipient: preference?.whatsappOptIn && preference.phone ? preference.phone : null },
  ];
}

export interface SendNotificationInput {
  userId: string | null;
  /** A guest order's Order.guestEmail — ignored for a registered user (their User.email is used instead). */
  recipientOverrideEmail?: string | null;
  templateKey: string;
  variables: Record<string, string | number>;
  /** OrderIntegrationEvent.id | RewardTransaction.id | ReferralAttribution.id — see schema.prisma's NotificationLog doc comment. */
  triggeringEventId: string;
}

async function writeLog(input: CreateLogInput): Promise<void> {
  try {
    await notificationRepository.createLog(input);
  } catch (error) {
    // A genuine race on the same (triggeringEventId, templateKey, recipient) — already logged, fine.
    if (!isUniqueConstraintViolation(error)) throw error;
  }
}

const NO_CONTACT_PLACEHOLDER = "(none)";

async function sendToChannel(channel: NotificationChannel, recipient: string | null, input: SendNotificationInput): Promise<void> {
  const dedupRecipient = recipient ?? NO_CONTACT_PLACEHOLDER;

  // The idempotent short-circuit — checked before ever calling a provider,
  // and before writing a SkippedNoConsent row twice for the same fact.
  const existing = await notificationRepository.findLogEntry(input.triggeringEventId, input.templateKey, channel, dedupRecipient);
  if (existing) return;

  if (!recipient) {
    await writeLog({
      userId: input.userId,
      recipient: dedupRecipient,
      channel,
      templateKey: input.templateKey,
      status: "SkippedNoConsent",
      triggeringEventId: input.triggeringEventId,
    });
    return;
  }

  const template = await notificationRepository.findTemplate(input.templateKey, channel);
  if (!template || !template.isActive) {
    await writeLog({
      userId: input.userId,
      recipient,
      channel,
      templateKey: input.templateKey,
      status: "Failed",
      error: "No active template configured.",
      triggeringEventId: input.triggeringEventId,
    });
    return;
  }

  const provider = getProviderForChannel(channel);
  const subject = template.subject ? renderTemplate(template.subject, input.variables) : null;
  const body = renderTemplate(template.body, input.variables);
  const result = await provider.send(recipient, subject, body);

  await writeLog({
    userId: input.userId,
    recipient,
    channel,
    templateKey: input.templateKey,
    status: result.status === "sent" ? "Sent" : "Failed",
    provider: provider.name,
    providerReference: result.providerReference ?? null,
    error: result.error ?? null,
    triggeringEventId: input.triggeringEventId,
  });
}

/**
 * Never throws outward — a notification failure must never affect the
 * business action it's reporting on. Each channel is isolated: one
 * channel failing doesn't stop another from being attempted.
 */
export async function sendNotification(input: SendNotificationInput): Promise<void> {
  const targets = await resolveChannelTargets(input.userId, input.recipientOverrideEmail);
  for (const target of targets) {
    try {
      await sendToChannel(target.channel, target.recipient, input);
    } catch (error) {
      console.error(`[notification] failed to process ${input.templateKey} on ${target.channel}`, error);
    }
  }
}

const ORDER_EVENT_TEMPLATE_KEYS: Partial<Record<OrderEventType, string>> = {
  "order.confirmed": "order.confirmed",
  "order.dispatched": "order.dispatched",
  "order.delivered": "order.delivered",
  "order.cancelled": "order.cancelled",
};

/** Order-lifecycle notifications — see this file's header comment for why this is event-driven while points-earned/referral-qualified aren't. */
export const notificationsConsumer: OrderEventConsumer = {
  async onOrderEvent(eventId, type, orderId, payload) {
    const templateKey = ORDER_EVENT_TEMPLATE_KEYS[type];
    if (!templateKey) return;

    const order = await orderRepository.findOrderById(orderId);
    if (!order) return;

    const userId = typeof payload.userId === "string" ? payload.userId : null;
    await sendNotification({
      userId,
      recipientOverrideEmail: order.guestEmail,
      templateKey,
      variables: {
        orderNumber: order.orderNumber,
        grandTotal: order.grandTotal.toFixed(2),
        currency: "LKR",
      },
      triggeringEventId: eventId,
    });
  },
};

/**
 * STORY-033. A security-critical, always-send email (password reset)
 * doesn't fit sendNotification's model: it isn't gated by marketing
 * opt-in (emailOptIn is default-on for that too, but a reset must never
 * be skippable), and it has no OrderIntegrationEvent/RewardTransaction/
 * ReferralAttribution id to key triggeringEventId's dedup on — each
 * reset token is already unique, so no dedup is needed. Reuses this
 * file's own provider cache (getProviderForChannel) rather than
 * constructing a second EmailProvider/Ethereal sandbox account.
 */
export async function sendTransactionalEmail(recipient: string, subject: string, body: string): Promise<void> {
  const provider = getProviderForChannel("Email");
  await provider.send(recipient, subject, body);
}

export function getPreferenceForUser(userId: string) {
  return notificationRepository.findPreferenceByUserId(userId);
}

export function updatePreferenceForUser(userId: string, input: notificationRepository.UpsertPreferenceInput) {
  return notificationRepository.upsertPreference(userId, input);
}
