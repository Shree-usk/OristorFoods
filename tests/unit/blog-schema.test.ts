import { describe, expect, it } from "vitest";
import { blogCommentInputSchema, blogListQuerySchema, blogSlugParamSchema } from "@/validation/blog.schema";

describe("blogListQuerySchema", () => {
  it("defaults page/pageSize and leaves tag/author undefined when absent", () => {
    const result = blogListQuerySchema.parse({});
    expect(result).toMatchObject({ page: 1, pageSize: 12 });
    expect(result.tag).toBeUndefined();
    expect(result.author).toBeUndefined();
  });

  it("passes through combined tag and author filters", () => {
    const result = blogListQuerySchema.parse({ tag: "spices", author: "amara-perera" });
    expect(result).toMatchObject({ tag: "spices", author: "amara-perera" });
  });

  it("falls back to defaults for malformed page/pageSize", () => {
    expect(blogListQuerySchema.parse({ page: "nope", pageSize: "-1" })).toMatchObject({ page: 1, pageSize: 12 });
  });
});

describe("blogSlugParamSchema", () => {
  it("accepts a non-empty slug and rejects an empty one", () => {
    expect(blogSlugParamSchema.safeParse({ slug: "a-real-post" }).success).toBe(true);
    expect(blogSlugParamSchema.safeParse({ slug: "" }).success).toBe(false);
  });
});

describe("blogCommentInputSchema", () => {
  it("accepts a valid guest submission", () => {
    const result = blogCommentInputSchema.safeParse({
      name: "Nadeesha",
      email: "nadeesha@example.com",
      body: "Lovely post, thank you!",
      honeypot: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid submission with name/email omitted (authenticated caller)", () => {
    const result = blogCommentInputSchema.safeParse({ body: "Great recipe idea.", honeypot: "" });
    expect(result.success).toBe(true);
  });

  it("rejects a non-empty honeypot value", () => {
    const result = blogCommentInputSchema.safeParse({ body: "Buy cheap watches now", honeypot: "I am a bot" });
    expect(result.success).toBe(false);
  });

  it("rejects a body that is too short or too long", () => {
    expect(blogCommentInputSchema.safeParse({ body: "hi", honeypot: "" }).success).toBe(false);
    expect(blogCommentInputSchema.safeParse({ body: "x".repeat(2001), honeypot: "" }).success).toBe(false);
  });

  it("rejects a malformed email when provided", () => {
    const result = blogCommentInputSchema.safeParse({ name: "A", email: "not-an-email", body: "A fine comment.", honeypot: "" });
    expect(result.success).toBe(false);
  });
});
