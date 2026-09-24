import { describe, expect, it } from "vitest";

import { answerTextSchema, questionInputSchema, questionListQuerySchema } from "@/validation/question.schema";

describe("questionInputSchema", () => {
  it("accepts a valid question and trims it", () => {
    expect(questionInputSchema.parse({ text: "  Is this chilli very hot?  " })).toEqual({ text: "Is this chilli very hot?" });
  });

  it("measures length after trimming (10–500)", () => {
    expect(questionInputSchema.safeParse({ text: `  ${"a".repeat(9)}  ` }).success).toBe(false);
    expect(questionInputSchema.safeParse({ text: "a".repeat(10) }).success).toBe(true);
    expect(questionInputSchema.safeParse({ text: "a".repeat(501) }).success).toBe(false);
  });

  it("gives a friendly message when too short", () => {
    expect(questionInputSchema.safeParse({ text: "Hot?" }).error?.issues[0]?.message).toBe(
      "Question must be at least 10 characters",
    );
  });
});

describe("answerTextSchema", () => {
  it("trims and requires 1–2000 characters", () => {
    expect(answerTextSchema.parse("  Yes.  ")).toBe("Yes.");
    expect(answerTextSchema.safeParse("   ").success).toBe(false);
    expect(answerTextSchema.safeParse("a".repeat(2001)).success).toBe(false);
  });
});

describe("questionListQuerySchema", () => {
  it("applies defaults", () => {
    expect(questionListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
  });

  it("coerces params and trims q", () => {
    expect(questionListQuerySchema.parse({ page: "2", pageSize: "20", q: "  storage tips " })).toEqual({
      page: 2,
      pageSize: 20,
      q: "storage tips",
    });
  });

  it("treats a blank q as no filter", () => {
    expect(questionListQuerySchema.parse({ q: "   " }).q).toBeUndefined();
  });

  it.each([{ pageSize: "51" }, { page: "0" }, { q: "a".repeat(101) }])("rejects %o", (query) => {
    expect(questionListQuerySchema.safeParse(query).success).toBe(false);
  });
});
