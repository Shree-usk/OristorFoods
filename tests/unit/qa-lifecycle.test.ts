// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createQuestion, findQuestionById } from "@/repositories/qa.repository";
import { registerQaNotifier, resetQaNotifierForTesting } from "@/services/qa-notifications";
import { InvalidQuestionInputError, InvalidQuestionTransitionError, QuestionNotFoundError } from "@/services/qa.errors";
import { advanceQuestionToPublished, answerQuestion, canTransitionQuestion, changeQuestionStatus } from "@/services/qa.service";

let sequence = 0;
const onQuestionSubmitted = vi.fn(async () => {});
const onQuestionPublished = vi.fn(async () => {});

async function makePendingQuestion() {
  sequence += 1;
  const product = await createProduct({ sku: `QA-LIFE-${sequence}`, slug: `qa-life-${sequence}`, name: "Chilli Powder 100g", status: "Published" });
  const user = await prisma.user.create({ data: { email: `qa-life-${sequence}@test.com` } });
  return createQuestion({ productId: product.id, userId: user.id, text: "Is it very hot?" });
}

beforeEach(() => {
  registerQaNotifier({ onQuestionSubmitted, onQuestionPublished });
});

afterEach(async () => {
  resetQaNotifierForTesting();
  vi.clearAllMocks();
  await prisma.question.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

const statuses: QuestionStatus[] = ["Pending", "Answered", "Approved", "Published", "Rejected"];
const allowed = new Set([
  "Pending>Answered",
  "Pending>Rejected",
  "Answered>Approved",
  "Answered>Rejected",
  "Approved>Published",
  "Approved>Rejected",
  "Published>Rejected",
]);

describe("canTransitionQuestion", () => {
  const pairs = statuses.flatMap((from) => statuses.map((to) => [from, to] as const));

  it.each(pairs)("%s -> %s matches the blueprint workflow", (from, to) => {
    expect(canTransitionQuestion(from, to)).toBe(allowed.has(`${from}>${to}`));
  });
});

describe("answerQuestion", () => {
  it("moves Pending to Answered and records the answer", async () => {
    const question = await makePendingQuestion();
    const staff = await prisma.user.create({ data: { email: "qa-staff@test.com", name: "Staff" } });

    const answered = await answerQuestion(question.id, "  Medium heat.  ", staff.id);

    expect(answered).toMatchObject({ status: "Answered", answerText: "Medium heat.", answeredById: staff.id });
    expect(answered.answeredAt).toBeInstanceOf(Date);
  });

  it("allows no moderator (dev tooling) — answeredById stays null", async () => {
    const question = await makePendingQuestion();

    expect((await answerQuestion(question.id, "Yes.")).answeredById).toBeNull();
  });

  it("rejects a blank answer", async () => {
    const question = await makePendingQuestion();

    await expect(answerQuestion(question.id, "   ")).rejects.toBeInstanceOf(InvalidQuestionInputError);
  });

  it("refuses a question that isn't Pending, and an unknown question", async () => {
    const question = await makePendingQuestion();
    await answerQuestion(question.id, "First answer.");

    await expect(answerQuestion(question.id, "Second answer.")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
    await expect(answerQuestion("missing", "Answer.")).rejects.toBeInstanceOf(QuestionNotFoundError);
  });
});

describe("changeQuestionStatus", () => {
  it("never accepts Answered — the answer path can't be bypassed", async () => {
    const question = await makePendingQuestion();

    await expect(changeQuestionStatus(question.id, "Answered")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
    expect((await findQuestionById(question.id))?.status).toBe("Pending");
  });

  it("rejects transitions outside the workflow", async () => {
    const question = await makePendingQuestion();

    await expect(changeQuestionStatus(question.id, "Published")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
    await expect(changeQuestionStatus("missing", "Rejected")).rejects.toBeInstanceOf(QuestionNotFoundError);
  });

  it("publishes, sets publishedAt and notifies the customer exactly once", async () => {
    const question = await makePendingQuestion();
    await answerQuestion(question.id, "Medium heat.");
    await changeQuestionStatus(question.id, "Approved");
    expect(onQuestionPublished).not.toHaveBeenCalled();

    const published = await changeQuestionStatus(question.id, "Published");

    expect(published.status).toBe("Published");
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(onQuestionPublished).toHaveBeenCalledOnce();
    expect(onQuestionPublished).toHaveBeenCalledWith({
      questionId: question.id,
      productId: question.productId,
      productSlug: expect.stringMatching(/^qa-life-/),
      productName: "Chilli Powder 100g",
      askedByUserId: question.userId,
      publishedAt: published.publishedAt,
    });
  });

  it("can take a published question down without notifying", async () => {
    const question = await makePendingQuestion();
    await answerQuestion(question.id, "Medium heat.");
    await changeQuestionStatus(question.id, "Approved");
    await changeQuestionStatus(question.id, "Published");
    onQuestionPublished.mockClear();

    const rejected = await changeQuestionStatus(question.id, "Rejected");

    expect(rejected.status).toBe("Rejected");
    expect(onQuestionPublished).not.toHaveBeenCalled();
    expect(onQuestionSubmitted).not.toHaveBeenCalled();
  });
});

describe("advanceQuestionToPublished", () => {
  it("answers, approves and publishes a Pending question, notifying once", async () => {
    const question = await makePendingQuestion();

    const published = await advanceQuestionToPublished(question.id, "Medium heat.");

    expect(published).toMatchObject({ status: "Published", answerText: "Medium heat." });
    expect(onQuestionPublished).toHaveBeenCalledOnce();
  });

  it("leaves a Published question as it is", async () => {
    const question = await makePendingQuestion();
    await advanceQuestionToPublished(question.id, "Medium heat.");

    expect((await advanceQuestionToPublished(question.id, "Ignored")).answerText).toBe("Medium heat.");
    expect(onQuestionPublished).toHaveBeenCalledOnce();
  });

  it("refuses a Rejected question", async () => {
    const question = await makePendingQuestion();
    await changeQuestionStatus(question.id, "Rejected");

    await expect(advanceQuestionToPublished(question.id, "Answer.")).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
  });
});
