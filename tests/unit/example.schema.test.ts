import { describe, expect, it } from "vitest";

import { newsletterSignupSchema } from "@/validation/example.schema";

describe("newsletterSignupSchema", () => {
  it("accepts a valid email", () => {
    const result = newsletterSignupSchema.safeParse({ email: "cook@example.com" });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid email", () => {
    const result = newsletterSignupSchema.safeParse({ email: "not-an-email" });
    expect(result.success).toBe(false);
  });
});
