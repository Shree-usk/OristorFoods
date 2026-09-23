// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db";
import { createStandardPrice } from "@/repositories/pricing.repository";
import { createProduct } from "@/repositories/product.repository";
import { resetProductDetailExtensionsForTesting } from "@/services/product-detail-extensions";
import { getProductDetail } from "@/services/product.service";
import { registerQaNotifier, resetQaNotifierForTesting } from "@/services/qa-notifications";
import { InvalidQuestionInputError, QaProductNotFoundError } from "@/services/qa.errors";
import {
  answerQuestion,
  changeQuestionStatus,
  getQaSummaryForProduct,
  listMyOpenQuestions,
  listPublishedQuestions,
  registerQaProviders,
  splitSearchWords,
  submitQuestion,
} from "@/services/qa.service";

let sequence = 0;
const onQuestionSubmitted = vi.fn(async () => {});
const onQuestionPublished = vi.fn(async () => {});
const defaultQuery = { page: 1, pageSize: 10 };

async function makeProduct(status: "Published" | "Draft" = "Published") {
  sequence += 1;
  const product = await createProduct({ sku: `QA-SVC-${sequence}`, slug: `qa-svc-${sequence}`, name: "Turmeric Powder", status });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "400.00" });
  return product;
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `qa-svc-${sequence}@test.com` } });
}

async function publishedQuestion(productSlug: string, text: string, answer: string) {
  const question = await submitQuestion((await makeUser()).id, productSlug, { text });
  await answerQuestion(question.id, answer);
  await changeQuestionStatus(question.id, "Approved");
  await changeQuestionStatus(question.id, "Published");
  return question;
}

beforeEach(() => {
  registerQaNotifier({ onQuestionSubmitted, onQuestionPublished });
});

afterEach(async () => {
  resetQaNotifierForTesting();
  resetProductDetailExtensionsForTesting();
  vi.restoreAllMocks();
  vi.clearAllMocks();
  await prisma.question.deleteMany();
  await prisma.standardPrice.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("submitQuestion", () => {
  it("creates a Pending question and notifies admin once with the event", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const question = await submitQuestion(user.id, product.slug, { text: "  Is it organic?  Asking for my mum. " });

    expect(question).toMatchObject({ text: "Is it organic?  Asking for my mum.", status: "Pending" });
    expect(onQuestionSubmitted).toHaveBeenCalledOnce();
    expect(onQuestionSubmitted).toHaveBeenCalledWith({
      questionId: question.id,
      productId: product.id,
      productSlug: product.slug,
      productName: "Turmeric Powder",
      text: "Is it organic?  Asking for my mum.",
      askedByUserId: user.id,
      submittedAt: expect.any(Date),
    });
  });

  it("allows several open questions from the same customer", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    await submitQuestion(user.id, product.slug, { text: "First question here?" });

    await expect(submitQuestion(user.id, product.slug, { text: "Second question here?" })).resolves.toMatchObject({
      status: "Pending",
    });
  });

  it("rejects an unknown or unpublished product and invalid text, without notifying", async () => {
    const draft = await makeProduct("Draft");
    const product = await makeProduct();
    const user = await makeUser();

    await expect(submitQuestion(user.id, draft.slug, { text: "Is it organic?" })).rejects.toBeInstanceOf(QaProductNotFoundError);
    await expect(submitQuestion(user.id, "nope", { text: "Is it organic?" })).rejects.toBeInstanceOf(QaProductNotFoundError);
    await expect(submitQuestion(user.id, product.slug, { text: "Hot?" })).rejects.toBeInstanceOf(InvalidQuestionInputError);
    expect(onQuestionSubmitted).not.toHaveBeenCalled();
  });

  it("still succeeds when the notifier throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    registerQaNotifier({
      onQuestionSubmitted: async () => {
        throw new Error("down");
      },
      onQuestionPublished: async () => {},
    });
    const product = await makeProduct();

    await expect(submitQuestion((await makeUser()).id, product.slug, { text: "Does it contain salt?" })).resolves.toMatchObject({
      status: "Pending",
    });
  });
});

describe("splitSearchWords", () => {
  it("splits on whitespace and drops blanks", () => {
    expect(splitSearchWords("  storage   tips ")).toEqual(["storage", "tips"]);
    expect(splitSearchWords(undefined)).toEqual([]);
    expect(splitSearchWords("   ")).toEqual([]);
  });
});

describe("listPublishedQuestions", () => {
  it("returns only Published Q&A as public DTOs with pagination metadata", async () => {
    const product = await makeProduct();
    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");
    await submitQuestion((await makeUser()).id, product.slug, { text: "Still pending question?" });

    const page = await listPublishedQuestions(product.slug, defaultQuery);

    expect(page).toMatchObject({ total: 1, page: 1, pageSize: 10 });
    expect(page.items[0]).toEqual({
      id: expect.any(String),
      question: "How should I store it?",
      answer: "In an airtight jar.",
      publishedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
  });

  it("filters by every word of q across question and answer", async () => {
    const product = await makeProduct();
    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");
    await publishedQuestion(product.slug, "Is it very hot?", "Medium heat.");

    expect((await listPublishedQuestions(product.slug, { ...defaultQuery, q: "STORE airtight" })).total).toBe(1);
    expect((await listPublishedQuestions(product.slug, { ...defaultQuery, q: "store heat" })).total).toBe(0);
    expect((await listPublishedQuestions(product.slug, defaultQuery)).total).toBe(2);
  });

  it("rejects an unpublished product", async () => {
    const draft = await makeProduct("Draft");

    await expect(listPublishedQuestions(draft.slug, defaultQuery)).rejects.toBeInstanceOf(QaProductNotFoundError);
  });
});

describe("listMyOpenQuestions", () => {
  it("returns the customer's own open questions only", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const open = await submitQuestion(user.id, product.slug, { text: "My open question?" });
    const toReject = await submitQuestion(user.id, product.slug, { text: "My rejected question?" });
    await changeQuestionStatus(toReject.id, "Rejected");
    await submitQuestion((await makeUser()).id, product.slug, { text: "Someone else's question?" });

    const mine = await listMyOpenQuestions(user.id, product.slug);

    expect(mine).toEqual([{ id: open.id, text: "My open question?", status: "Pending", createdAt: expect.any(String) }]);
  });
});

describe("PDP provider", () => {
  it("returns null without Published Q&A, else the first page and total", async () => {
    const product = await makeProduct();
    expect(await getQaSummaryForProduct(product.id)).toBeNull();

    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");
    const summary = await getQaSummaryForProduct(product.id);

    expect(summary?.totalCount).toBe(1);
    expect(summary?.previewItems[0]?.question).toBe("How should I store it?");
  });

  it("registerQaProviders makes getProductDetail include real Q&A", async () => {
    const product = await makeProduct();
    await publishedQuestion(product.slug, "How should I store it?", "In an airtight jar.");

    registerQaProviders();

    expect((await getProductDetail(product.slug))?.qaSummary?.totalCount).toBe(1);
  });
});
