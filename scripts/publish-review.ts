/**
 * Dev-only: publishes a review without the moderation console (STORY-045).
 *   npm run review:publish -- <reviewId>
 * Goes through review.service.ts's real workflow, so the product's rating
 * summary is recalculated exactly as it will be in production.
 */
import "dotenv/config";

import { prisma } from "../src/lib/db";
import { advanceReviewToPublished } from "../src/services/review.service";

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "review:publish is a local development tool. In production, reviews are published from the moderation console (STORY-045).",
    );
  }
  const reviewId = process.argv[2];
  if (!reviewId) throw new Error("Usage: npm run review:publish -- <reviewId>");

  const review = await advanceReviewToPublished(reviewId);
  console.log(`Review ${review.id} is now ${review.status}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
