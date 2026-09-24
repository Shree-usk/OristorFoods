/**
 * Next.js calls register() once when the server starts. It runs in both the
 * Node.js and Edge runtimes; Prisma only loads on Node.js, so the service is
 * imported only there.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const [{ registerReviewProviders }, { registerQaProviders }, { registerRecipeProviders }] = await Promise.all([
      import("@/services/review.service"),
      import("@/services/qa.service"),
      import("@/services/recipe.service"),
    ]);
    registerReviewProviders();
    registerQaProviders();
    registerRecipeProviders();
  }
}
