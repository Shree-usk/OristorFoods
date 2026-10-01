/**
 * STORY-046.1. Notification hook for recipe Q&A: "notify customer" when an
 * answer is published. Mirrors qa-notifications.ts's registry shape, but
 * only the one event the spec asks for ("Customer receives the existing
 * notification when their answer is published, reusing the existing
 * notification infrastructure") — no admin-notify-on-submit channel, same
 * deliberate deferral as STORY-046 (no admin-alert infra exists anywhere
 * in this codebase to extend).
 *
 * Contract: recipe-qa.service.ts calls notify*() only AFTER the database
 * write has succeeded, and notify*() never throws — a failing notifier is
 * logged, so it can't fail a publish.
 *
 * Kept on globalThis for the same reason as qa-notifications.ts:
 * instrumentation.ts is bundled separately from route code, though this
 * notifier has no provider-registration seam to fill in later (it's real
 * from the start) — the holder indirection is kept anyway for test-time
 * swapping (resetRecipeQaNotifierForTesting) and consistency with the
 * sibling file.
 */
import { sendNotification } from "@/services/notification.service";

export interface RecipeQuestionPublishedEvent {
  questionId: string;
  recipeId: string;
  recipeTitle: string;
  askedByCustomerId: string;
  publishedAt: Date;
}

export interface RecipeQaNotifier {
  onQuestionPublished(event: RecipeQuestionPublishedEvent): Promise<void>;
}

const sendingNotifier: RecipeQaNotifier = {
  async onQuestionPublished(event) {
    await sendNotification({
      userId: event.askedByCustomerId,
      templateKey: "recipe_qa.question_answered",
      variables: { recipeTitle: event.recipeTitle },
      triggeringEventId: event.questionId,
    });
  },
};

const globalForRecipeQa = globalThis as unknown as { __oristorRecipeQaNotifier?: { notifier: RecipeQaNotifier } };
const holder = (globalForRecipeQa.__oristorRecipeQaNotifier ??= { notifier: sendingNotifier });

export function registerRecipeQaNotifier(notifier: RecipeQaNotifier): void {
  holder.notifier = notifier;
}

export async function notifyRecipeQuestionPublished(event: RecipeQuestionPublishedEvent): Promise<void> {
  try {
    await holder.notifier.onQuestionPublished(event);
  } catch (error) {
    console.error("[recipe-qa-notify] onQuestionPublished failed", error);
  }
}

/** Test-only: restores the default (sending) notifier. */
export function resetRecipeQaNotifierForTesting(): void {
  holder.notifier = sendingNotifier;
}
