/**
 * Next.js calls register() once when the server starts. It runs in both the
 * Node.js and Edge runtimes; Prisma only loads on Node.js, so the service is
 * imported only there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ registerReviewProviders }, { registerQaProviders }, { registerRecipeProviders }, { registerOrderEventConsumer }, { rewardsConsumer }] =
      await Promise.all([
        import("@/services/review.service"),
        import("@/services/qa.service"),
        import("@/services/recipe.service"),
        import("@/services/order-integration.service"),
        import("@/services/rewards.service"),
      ]);
    registerReviewProviders();
    registerQaProviders();
    registerRecipeProviders();
    // STORY-030: registers this process's ONE order-event consumer slot
    // (order-integration.service.ts supports exactly one at a time — see
    // rewards.service.ts's own header comment and
    // docs/architecture-decisions.md for the known gap this leaves for
    // whichever future story next needs the same hook).
    registerOrderEventConsumer(rewardsConsumer);
  }
}
