/**
 * Next.js calls register() once when the server starts. It runs in both the
 * Node.js and Edge runtimes; Prisma only loads on Node.js, so the service is
 * imported only there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [
      { registerReviewProviders },
      { registerQaProviders },
      { registerRecipeProviders },
      { registerBlogProviders },
      { registerFoodAcademyProviders },
      { registerOrderEventConsumer },
      { rewardsConsumer },
      { referralConsumer },
      { notificationsConsumer },
    ] = await Promise.all([
      import("@/services/review.service"),
      import("@/services/qa.service"),
      import("@/services/recipe.service"),
      import("@/services/blog.service"),
      import("@/services/food-academy.service"),
      import("@/services/order-integration.service"),
      import("@/services/rewards.service"),
      import("@/services/referral.service"),
      import("@/services/notification.service"),
    ]);
    registerReviewProviders();
    registerQaProviders();
    registerRecipeProviders();
    // STORY-061.
    registerBlogProviders();
    registerFoodAcademyProviders();
    // order-integration.service.ts fans out to every registered consumer
    // (STORY-031 turned what used to be a single slot into a list).
    registerOrderEventConsumer(rewardsConsumer);
    registerOrderEventConsumer(referralConsumer);
    registerOrderEventConsumer(notificationsConsumer);
  }
}
