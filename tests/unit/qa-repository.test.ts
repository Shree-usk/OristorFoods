// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import type { QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import {
  answerPendingQuestion,
  createQuestion,
  findQuestionById,
  listOpenQuestionsByUser,
  listPublishedQuestions,
  updateQuestionStatus,
} from "@/repositories/qa.repository";

let sequence = 0;

async function makeProduct() {
  sequence += 1;
  return createProduct({ sku: `QA-REPO-${sequence}`, slug: `qa-repo-${sequence}`, name: "Chilli Powder", status: "Published" });
}

async function makeUser() {
  sequence += 1;
  return prisma.user.create({ data: { email: `qa-repo-${sequence}@test.com`, name: "Asker" } });
}

/** Test fixture: writes a question in any state directly. */
async function makeQuestion(
  productId: string,
  userId: string,
  overrides: { status?: QuestionStatus; text?: string; answerText?: string; publishedAt?: Date } = {},
) {
  return prisma.question.create({
    data: {
      productId,
      userId,
      text: overrides.text ?? "How spicy is this blend?",
      status: overrides.status ?? "Pending",
      answerText: overrides.answerText ?? null,
      publishedAt: overrides.publishedAt ?? null,
    },
  });
}

afterEach(async () => {
  await prisma.question.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
});

describe("createQuestion / findQuestionById", () => {
  it("creates Pending questions and allows several from the same customer on one product", async () => {
    const product = await makeProduct();
    const user = await makeUser();

    const first = await createQuestion({ productId: product.id, userId: user.id, text: "Is it gluten free?" });
    const second = await createQuestion({ productId: product.id, userId: user.id, text: "Where is it made?" });

    expect(first.status).toBe("Pending");
    expect(second.status).toBe("Pending");
    expect((await findQuestionById(first.id))?.text).toBe("Is it gluten free?");
  });
});

describe("listPublishedQuestions", () => {
  it("returns only Published questions, newest first, with total", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    await makeQuestion(product.id, user.id, { status: "Approved", answerText: "Yes" });
    const older = await makeQuestion(product.id, user.id, { status: "Published", answerText: "A", publishedAt: new Date("2026-01-01") });
    const newer = await makeQuestion(product.id, user.id, { status: "Published", answerText: "B", publishedAt: new Date("2026-02-01") });

    const result = await listPublishedQuestions(product.id, { words: [], skip: 0, take: 10 });

    expect(result.total).toBe(2);
    expect(result.items.map((item) => item.id)).toEqual([newer.id, older.id]);
  });

  it("requires every word to match the question or answer, case-insensitively", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const storage = await makeQuestion(product.id, user.id, {
      status: "Published",
      text: "How should I STORE it?",
      answerText: "Airtight jar, away from sunlight.",
      publishedAt: new Date(),
    });
    await makeQuestion(product.id, user.id, {
      status: "Published",
      text: "Is it very hot?",
      answerText: "Medium heat.",
      publishedAt: new Date(),
    });

    const byQuestion = await listPublishedQuestions(product.id, { words: ["store"], skip: 0, take: 10 });
    const acrossFields = await listPublishedQuestions(product.id, { words: ["store", "SUNLIGHT"], skip: 0, take: 10 });
    const noMatch = await listPublishedQuestions(product.id, { words: ["store", "hot"], skip: 0, take: 10 });

    expect(byQuestion.items.map((item) => item.id)).toEqual([storage.id]);
    expect(acrossFields.items.map((item) => item.id)).toEqual([storage.id]);
    expect(noMatch.total).toBe(0);
  });

  it("paginates with skip and take", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    for (let day = 1; day <= 3; day += 1) {
      await makeQuestion(product.id, user.id, { status: "Published", answerText: "Ok", publishedAt: new Date(`2026-03-0${day}`) });
    }

    const secondPage = await listPublishedQuestions(product.id, { words: [], skip: 2, take: 2 });

    expect(secondPage.total).toBe(3);
    expect(secondPage.items).toHaveLength(1);
  });
});

describe("listOpenQuestionsByUser", () => {
  it("returns only the user's Pending, Answered and Approved questions on that product", async () => {
    const product = await makeProduct();
    const otherProduct = await makeProduct();
    const user = await makeUser();
    const otherUser = await makeUser();
    const pending = await makeQuestion(product.id, user.id, { status: "Pending" });
    const answered = await makeQuestion(product.id, user.id, { status: "Answered", answerText: "Yes" });
    const approved = await makeQuestion(product.id, user.id, { status: "Approved", answerText: "Yes" });
    await makeQuestion(product.id, user.id, { status: "Published", answerText: "Yes", publishedAt: new Date() });
    await makeQuestion(product.id, user.id, { status: "Rejected" });
    await makeQuestion(product.id, otherUser.id, { status: "Pending" });
    await makeQuestion(otherProduct.id, user.id, { status: "Pending" });

    const open = await listOpenQuestionsByUser(product.id, user.id);

    expect(open.map((question) => question.id).sort()).toEqual([pending.id, answered.id, approved.id].sort());
  });
});

describe("answerPendingQuestion", () => {
  it("sets the answer fields and Answered status on a Pending question", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const staff = await makeUser();
    const question = await makeQuestion(product.id, user.id);
    const answeredAt = new Date();

    const answered = await answerPendingQuestion(question.id, { answerText: "Yes, it is.", answeredById: staff.id, answeredAt });

    expect(answered).toMatchObject({ status: "Answered", answerText: "Yes, it is.", answeredById: staff.id });
  });

  it("returns null and changes nothing when the question is no longer Pending", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const question = await makeQuestion(product.id, user.id, { status: "Rejected" });

    const result = await answerPendingQuestion(question.id, { answerText: "Late", answeredById: null, answeredAt: new Date() });

    expect(result).toBeNull();
    expect(await findQuestionById(question.id)).toMatchObject({ status: "Rejected", answerText: null });
  });
});

describe("updateQuestionStatus", () => {
  it("updates when the current status matches fromStatus", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const question = await makeQuestion(product.id, user.id, { status: "Approved", answerText: "Yes" });
    const publishedAt = new Date();

    const updated = await updateQuestionStatus(question.id, "Approved", { status: "Published", publishedAt });

    expect(updated?.status).toBe("Published");
    expect(updated?.publishedAt?.toISOString()).toBe(publishedAt.toISOString());
  });

  it("returns null and changes nothing on a stale fromStatus", async () => {
    const product = await makeProduct();
    const user = await makeUser();
    const question = await makeQuestion(product.id, user.id, { status: "Rejected" });

    expect(await updateQuestionStatus(question.id, "Approved", { status: "Published" })).toBeNull();
    expect((await findQuestionById(question.id))?.status).toBe("Rejected");
  });
});
