// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import type { QuestionStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { computeTotalTimeMinutes } from "@/lib/recipe-time";
import { createRecipe, createRecipeCategory } from "@/repositories/recipe.repository";
import { createQuestion, findQuestionById } from "@/repositories/recipe-qa.repository";
import { registerRecipeQaNotifier, resetRecipeQaNotifierForTesting } from "@/services/recipe-qa-notifications";
import { InvalidRecipeQuestionInputError, InvalidRecipeQuestionTransitionError, RecipeQuestionNotFoundError } from "@/services/recipe-qa.errors";
import { answerRecipeQuestion, canTransitionRecipeQuestion, changeRecipeQuestionStatus } from "@/services/recipe-qa.service";

let sequence = 0;
const onQuestionPublished = vi.fn(async () => {});

async function makeRecipe() {
  sequence += 1;
  const category = await createRecipeCategory({ name: `Category ${sequence}`, slug: `rq-life-category-${sequence}` });
  return createRecipe({
    slug: `rq-life-recipe-${sequence}`,
    title: `Recipe ${sequence}`,
    shortDescription: "A test recipe.",
    heroImage: "/images/products/export/curry-powder.webp",
    heroImageAlt: "Test hero image",
    categoryId: category.id,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    totalTimeMinutes: computeTotalTimeMinutes(10, 20),
    servings: 4,
    status: "Published",
  });
}

async function makePendingQuestion() {
  sequence += 1;
  const recipe = await makeRecipe();
  const customer = await prisma.user.create({ data: { email: `rq-life-${sequence}@test.com` } });
  return createQuestion({ recipeId: recipe.id, customerId: customer.id, text: "Can I substitute coconut milk?" });
}

afterEach(async () => {
  resetRecipeQaNotifierForTesting();
  vi.clearAllMocks();
  await prisma.recipeQuestion.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.recipeCategory.deleteMany();
  await prisma.user.deleteMany();
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: "@rq-lifecycle-test.test" } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: "rq-lifecycle-test-role-" } } });
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

describe("canTransitionRecipeQuestion", () => {
  const pairs = statuses.flatMap((from) => statuses.map((to) => [from, to] as const));

  it.each(pairs)("%s -> %s matches the Product Q&A workflow", (from, to) => {
    expect(canTransitionRecipeQuestion(from, to)).toBe(allowed.has(`${from}>${to}`));
  });
});

describe("answerRecipeQuestion", () => {
  it("moves Pending to Answered and records the answer, targeting AdminUser", async () => {
    const question = await makePendingQuestion();
    const role = await prisma.role.create({ data: { key: "rq-lifecycle-test-role-1", name: "Recipe QA Lifecycle Test Role" } });
    const staff = await prisma.adminUser.create({ data: { email: "staff@rq-lifecycle-test.test", name: "Staff", passwordHash: "unused", roleId: role.id } });

    const answered = await answerRecipeQuestion(question.id, "  Yes, coconut milk works well.  ", staff.id);

    expect(answered).toMatchObject({ status: "Answered", answerText: "Yes, coconut milk works well.", answeredById: staff.id });
    expect(answered.answeredAt).toBeInstanceOf(Date);
  });

  it("allows no moderator (dev tooling) — answeredById stays null", async () => {
    const question = await makePendingQuestion();

    expect((await answerRecipeQuestion(question.id, "Yes.")).answeredById).toBeNull();
  });

  it("rejects a blank answer", async () => {
    const question = await makePendingQuestion();

    await expect(answerRecipeQuestion(question.id, "   ")).rejects.toBeInstanceOf(InvalidRecipeQuestionInputError);
  });

  it("refuses a question that isn't Pending, and an unknown question", async () => {
    const question = await makePendingQuestion();
    await answerRecipeQuestion(question.id, "First answer.");

    await expect(answerRecipeQuestion(question.id, "Second answer.")).rejects.toBeInstanceOf(InvalidRecipeQuestionTransitionError);
    await expect(answerRecipeQuestion("missing", "Answer.")).rejects.toBeInstanceOf(RecipeQuestionNotFoundError);
  });
});

describe("changeRecipeQuestionStatus", () => {
  it("never accepts Answered — the answer path can't be bypassed", async () => {
    const question = await makePendingQuestion();

    await expect(changeRecipeQuestionStatus(question.id, "Answered")).rejects.toBeInstanceOf(InvalidRecipeQuestionTransitionError);
    expect((await findQuestionById(question.id))?.status).toBe("Pending");
  });

  it("rejects transitions outside the workflow", async () => {
    const question = await makePendingQuestion();

    await expect(changeRecipeQuestionStatus(question.id, "Published")).rejects.toBeInstanceOf(InvalidRecipeQuestionTransitionError);
    await expect(changeRecipeQuestionStatus("missing", "Rejected")).rejects.toBeInstanceOf(RecipeQuestionNotFoundError);
  });

  it("publishes, sets publishedAt, records approvedById and notifies the customer exactly once", async () => {
    const question = await makePendingQuestion();
    registerRecipeQaNotifier({ onQuestionPublished });
    const role = await prisma.role.create({ data: { key: "rq-lifecycle-test-role-2", name: "Recipe QA Lifecycle Test Role 2" } });
    const approver = await prisma.adminUser.create({ data: { email: "approver@rq-lifecycle-test.test", name: "Approver", passwordHash: "unused", roleId: role.id } });

    await answerRecipeQuestion(question.id, "Yes, coconut milk works well.");
    const approved = await changeRecipeQuestionStatus(question.id, "Approved", { approverId: approver.id });
    expect(approved.approvedById).toBe(approver.id);
    expect(onQuestionPublished).not.toHaveBeenCalled();

    const published = await changeRecipeQuestionStatus(question.id, "Published");

    expect(published.status).toBe("Published");
    expect(published.publishedAt).toBeInstanceOf(Date);
    expect(onQuestionPublished).toHaveBeenCalledOnce();
    expect(onQuestionPublished).toHaveBeenCalledWith({
      questionId: question.id,
      recipeId: question.recipeId,
      recipeTitle: expect.stringMatching(/^Recipe /),
      askedByCustomerId: question.customerId,
      publishedAt: published.publishedAt,
    });
  });

  it("rejects with an internal-only reason, stored on the row", async () => {
    const question = await makePendingQuestion();

    const rejected = await changeRecipeQuestionStatus(question.id, "Rejected", { rejectionReason: "Duplicate question." });

    expect(rejected.status).toBe("Rejected");
    expect(rejected.rejectionReason).toBe("Duplicate question.");
  });

  it("can take a published question down without notifying", async () => {
    const question = await makePendingQuestion();
    registerRecipeQaNotifier({ onQuestionPublished });
    await answerRecipeQuestion(question.id, "Yes, coconut milk works well.");
    await changeRecipeQuestionStatus(question.id, "Approved");
    await changeRecipeQuestionStatus(question.id, "Published");
    onQuestionPublished.mockClear();

    const rejected = await changeRecipeQuestionStatus(question.id, "Rejected");

    expect(rejected.status).toBe("Rejected");
    expect(onQuestionPublished).not.toHaveBeenCalled();
  });
});
