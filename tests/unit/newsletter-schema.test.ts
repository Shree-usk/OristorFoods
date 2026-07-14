import { describe, expect, it } from "vitest";

import { newsletterSubscribeSchema } from "@/validation/newsletter.schema";

describe("newsletterSubscribeSchema", () => {
  it("accepts a valid email", () => {
    const result = newsletterSubscribeSchema.safeParse({ email: "expat@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects a malformed email", () => {
    const result = newsletterSubscribeSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing email", () => {
    const result = newsletterSubscribeSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
