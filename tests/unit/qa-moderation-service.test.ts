// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import { InvalidQuestionTransitionError } from "@/services/qa.errors";
import { answer, approve, bulkModerate, listQuestionsForAdmin, publish, reject } from "@/services/qa-moderation.service";

const EMAIL_DOMAIN = "@qa-moderation-svc-test.test";
const ROLE_KEY_PREFIX = "qa-moderation-svc-test-role-";
const SLUG_PREFIX = "qa-moderation-svc-test-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `QA Moderation Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "QA", action: "View" },
    { module: "QA", action: "Edit" },
    { module: "QA", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeEditOnlyAdmin() {
  const role = await makeRole([
    { module: "QA", action: "View" },
    { module: "QA", action: "Edit" },
  ]);
  return makeAdminUser(role.id);
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}`, name: `Test Customer ${sequence}` } });
}

async function makeProduct() {
  sequence += 1;
  return prisma.product.create({ data: { sku: `${SLUG_PREFIX}${sequence}`, slug: `${SLUG_PREFIX}${sequence}`, name: `Test Product ${sequence}`, status: "Published" } });
}

async function makePendingQuestion() {
  const product = await makeProduct();
  const customer = await makeCustomer();
  const question = await prisma.question.create({ data: { productId: product.id, userId: customer.id, text: "Is this very spicy?", status: "Pending" } });
  return { question, product, customer };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.notificationLog.deleteMany({ where: { user: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.question.deleteMany({ where: { product: { slug: { startsWith: SLUG_PREFIX } } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: SLUG_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
});

describe("qa-moderation.service — answer/approve/publish/reject", () => {
  it("answers a Pending question, recording the AdminUser as answeredBy", async () => {
    const admin = await makeFullAccessAdmin();
    const { question } = await makePendingQuestion();

    const result = await answer(admin.id, question.id, "Medium heat, not too hot.");
    expect(result.status).toBe("Answered");
    expect(result.answerText).toBe("Medium heat, not too hot.");

    const row = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(row.answeredById).toBe(admin.id);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "question_answered" } });
    expect(log).not.toBeNull();
  });

  it("approves an Answered question, recording approvedById/approvedAt", async () => {
    const admin = await makeFullAccessAdmin();
    const { question } = await makePendingQuestion();
    await answer(admin.id, question.id, "Medium heat.");

    const result = await approve(admin.id, question.id);
    expect(result.status).toBe("Approved");

    const row = await prisma.question.findUniqueOrThrow({ where: { id: question.id } });
    expect(row.approvedById).toBe(admin.id);
    expect(row.approvedAt).toBeInstanceOf(Date);
  });

  it("publishing requires going through Answered and Approved first", async () => {
    const admin = await makeFullAccessAdmin();
    const { question } = await makePendingQuestion();

    await expect(publish(admin.id, question.id)).rejects.toBeInstanceOf(InvalidQuestionTransitionError);

    await answer(admin.id, question.id, "Medium heat.");
    await approve(admin.id, question.id);
    const published = await publish(admin.id, question.id);
    expect(published.status).toBe("Published");
  });

  it("publishing sends the real customer notification", async () => {
    const admin = await makeFullAccessAdmin();
    const { question, customer } = await makePendingQuestion();
    await answer(admin.id, question.id, "Medium heat.");
    await approve(admin.id, question.id);

    await publish(admin.id, question.id);

    const log = await prisma.notificationLog.findFirst({ where: { userId: customer.id, templateKey: "qa.question_answered", triggeringEventId: question.id } });
    expect(log).not.toBeNull();
  });

  it("rejects a question with an internal-only reason at any stage, never shown to the customer", async () => {
    const admin = await makeFullAccessAdmin();
    const { question } = await makePendingQuestion();

    const rejected = await reject(admin.id, question.id, "Off-topic question about a different product.");
    expect(rejected.status).toBe("Rejected");
    expect(rejected.rejectionReason).toBe("Off-topic question about a different product.");

    // A Rejected question is structurally invisible on the storefront —
    // listPublishedQuestions only ever selects status: "Published".
    const { listPublishedQuestionsForProduct } = await import("@/services/qa.service");
    const publicPage = await listPublishedQuestionsForProduct(question.productId, { page: 1, pageSize: 10 });
    expect(publicPage.items).toHaveLength(0);
  });

  it("rejects an illegal transition and an unknown question", async () => {
    const admin = await makeFullAccessAdmin();
    const { question } = await makePendingQuestion();
    await reject(admin.id, question.id, "Not relevant.");

    await expect(approve(admin.id, question.id)).rejects.toBeInstanceOf(InvalidQuestionTransitionError);
    await expect(answer(admin.id, "missing-id", "Answer.")).rejects.toThrow();
  });

  it("separation of duties: an Edit-only admin can answer but not approve or publish", async () => {
    const editor = await makeEditOnlyAdmin();
    const { question } = await makePendingQuestion();

    await expect(answer(editor.id, question.id, "Medium heat.")).resolves.toMatchObject({ status: "Answered" });
    await expect(approve(editor.id, question.id)).rejects.toBeInstanceOf(PermissionDeniedError);
    await expect(publish(editor.id, question.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("denies a View-only admin from answering", async () => {
    const role = await makeRole([{ module: "QA", action: "View" }]);
    const viewer = await makeAdminUser(role.id);
    const { question } = await makePendingQuestion();

    await expect(answer(viewer.id, question.id, "Medium heat.")).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});

describe("qa-moderation.service — queue listing", () => {
  it("lists questions filtered by status, and finds by product name search", async () => {
    const admin = await makeFullAccessAdmin();
    const { question, product } = await makePendingQuestion();
    await makePendingQuestion();

    const byStatus = await listQuestionsForAdmin(admin.id, { status: "Pending" }, 1, 20);
    expect(byStatus.total).toBeGreaterThanOrEqual(2);

    const bySearch = await listQuestionsForAdmin(admin.id, { search: product.name }, 1, 20);
    expect(bySearch.items.map((item) => item.id)).toEqual([question.id]);
  });
});

describe("qa-moderation.service — bulk moderation", () => {
  it("bulk-approves a mixed selection, skipping an item that's not actually Answered", async () => {
    const admin = await makeFullAccessAdmin();
    const { question: answered } = await makePendingQuestion();
    await answer(admin.id, answered.id, "Medium heat.");
    const { question: stillPending } = await makePendingQuestion();

    const result = await bulkModerate(admin.id, [answered.id, stillPending.id], "approve");

    expect(result.updated).toEqual([answered.id]);
    expect(result.skipped).toEqual([stillPending.id]);
  });
});
