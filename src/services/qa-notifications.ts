/**
 * Notification hooks for product Q&A (STORY-016): "notify admin" when a
 * question is submitted, "notify customer" when it is published.
 * STORY-032 (Notifications) registers real email/SMS/WhatsApp delivery with
 * registerQaNotifier() from src/instrumentation.ts. Until then the default
 * notifier just logs a [qa-notify] line — a documented temporary fallback.
 *
 * Contract: qa.service.ts calls notify*() only AFTER the database write has
 * succeeded, and notify*() never throws — a failing notifier is logged, so it
 * can't fail a submission or a publish.
 *
 * Kept on globalThis for the same reason as product-detail-extensions.ts:
 * instrumentation.ts is bundled separately from route code.
 */
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

const loggingNotifier: QaNotifier = {
  async onQuestionSubmitted(event) {
    console.info(
      `[qa-notify] question submitted ${event.questionId} on ${event.productSlug} — notify admin (STORY-032 not wired yet)`,
    );
  },
  async onQuestionPublished(event) {
    console.info(
      `[qa-notify] question published ${event.questionId} on ${event.productSlug} — notify customer ${event.askedByUserId} (STORY-032 not wired yet)`,
    );
  },
};

const globalForQa = globalThis as unknown as { __oristorQaNotifier?: { notifier: QaNotifier } };
const holder = (globalForQa.__oristorQaNotifier ??= { notifier: loggingNotifier });

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

/** Test-only: restores the default logging notifier. */
export function resetQaNotifierForTesting(): void {
  holder.notifier = loggingNotifier;
}
