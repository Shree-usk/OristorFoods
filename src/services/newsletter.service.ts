import type { NewsletterSubscribeInput } from "@/validation/newsletter.schema";

/**
 * Stub implementation — no real email/CRM/Marketing Console integration
 * yet (that's an Enterprise Platform / Marketing Console epic story).
 * Route handlers call this, never an email provider SDK directly, so the
 * real integration can be dropped in here later without touching the API
 * route or the form.
 */
export async function subscribe(input: NewsletterSubscribeInput): Promise<{ subscribed: true }> {
  console.log(`[newsletter.service] stub subscribe: ${input.email}`);
  return { subscribed: true };
}
