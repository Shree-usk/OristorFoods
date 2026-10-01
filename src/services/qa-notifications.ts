/**
 * Notification hooks for product Q&A (STORY-016): "notify admin" when a
 * question is submitted, "notify customer" when it is published.
 *
 * STORY-046 wires the customer-facing half for real: registerQaProviders()
 * (qa.service.ts, called from src/instrumentation.ts) registers
 * sendingQaNotifier below, whose onQuestionPublished calls the established
 * sendNotification() (STORY-032). onQuestionSubmitted (the admin-facing
 * "notify admin" half) deliberately stays log-only -- this codebase has no
 * admin-targeted notification channel (email/Slack to staff) anywhere to
 * extend, and the admin Dashboard's live "Pending Product Q&A" count widget
 * (STORY-039) already gives staff real-time visibility. A documented,
 * deliberate deferral, not a silent gap -- see docs/architecture-decisions.md.
 *
 * Contract: qa.service.ts calls notify*() only AFTER the database write has
 * succeeded, and notify*() never throws — a failing notifier is logged, so it
 * can't fail a submission or a publish.
 *
 * Kept on globalThis for the same reason as product-detail-extensions.ts:
 * instrumentation.ts is bundled separately from route code.
 */
import { sendNotification } from "@/services/notification.service";

export interface QuestionSubmittedEvent {
  questionId: string;
  productId: string;
  productSlug: string;
  productName: string;
  text: string;
  askedByUserId: string;
  submittedAt: Date;
}

export interface QuestionPublishedEvent {
  questionId: string;
  productId: string;
  productSlug: string;
  productName: string;
  askedByUserId: string;
  publishedAt: Date;
}

export interface QaNotifier {
  onQuestionSubmitted(event: QuestionSubmittedEvent): Promise<void>;
  onQuestionPublished(event: QuestionPublishedEvent): Promise<void>;
}

/**
 * STORY-046. The real notifier: onQuestionPublished sends an actual customer
 * notification; onQuestionSubmitted (admin-facing) stays log-only (see the
 * file header). Registered as the default by registerQaProviders().
 */
const sendingQaNotifier: QaNotifier = {
  async onQuestionSubmitted(event) {
    console.info(
      `[qa-notify] question submitted ${event.questionId} on ${event.productSlug} — notify admin (no admin channel built; see Dashboard's Pending Product Q&A widget)`,
    );
  },
  async onQuestionPublished(event) {
    await sendNotification({
      userId: event.askedByUserId,
      templateKey: "qa.question_answered",
      variables: { productName: event.productName },
      triggeringEventId: event.questionId,
    });
  },
};

const globalForQa = globalThis as unknown as { __oristorQaNotifier?: { notifier: QaNotifier } };
const holder = (globalForQa.__oristorQaNotifier ??= { notifier: sendingQaNotifier });

export function registerQaNotifier(notifier: QaNotifier): void {
  holder.notifier = notifier;
}

export async function notifyQuestionSubmitted(event: QuestionSubmittedEvent): Promise<void> {
  try {
    await holder.notifier.onQuestionSubmitted(event);
  } catch (error) {
    console.error("[qa-notify] onQuestionSubmitted failed", error);
  }
}

export async function notifyQuestionPublished(event: QuestionPublishedEvent): Promise<void> {
  try {
    await holder.notifier.onQuestionPublished(event);
  } catch (error) {
    console.error("[qa-notify] onQuestionPublished failed", error);
  }
}

/** Test-only: restores the default (sending) notifier. */
export function resetQaNotifierForTesting(): void {
  holder.notifier = sendingQaNotifier;
}
