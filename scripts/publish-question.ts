/**
 * Dev-only: answers and publishes a question without the moderation console
 * (STORY-046).
 *   npm run qa:publish -- <questionId> "<answer text>"
 * Goes through qa.service.ts's real workflow, so the notify-customer hook
 * fires exactly as it will in production.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { advanceQuestionToPublished } from "../src/services/qa.service";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "qa:publish is a local development tool. In production, questions are published from the moderation console (STORY-046).",
    );
  }
  const [questionId, answerText] = process.argv.slice(2);
  if (!questionId || !answerText) throw new Error('Usage: npm run qa:publish -- <questionId> "<answer text>"');

  const question = await advanceQuestionToPublished(questionId, answerText);
  console.log(`Question ${question.id} is now ${question.status}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
