// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { PermissionDeniedError } from "@/services/permission.errors";
import {
  RecipeAdminIllegalTransitionError,
  RecipeAdminNotDraftError,
  RecipeAdminSlugConflictError,
  RecipePublishReadinessError,
} from "@/services/recipe-admin.errors";
import {
  approve,
  archive,
  createRecipe,
  deleteRecipe,
  publish,
  reject,
  restore,
  submitForReview,
  updateRecipe,
} from "@/services/recipe-admin.service";
import type { RecipeAdminValidatedInput } from "@/validation/recipe-admin.schema";

const EMAIL_DOMAIN = "@recipe-admin-svc-test.test";
const ROLE_KEY_PREFIX = "recipe-admin-svc-test-role-";
const CATEGORY_SLUG_PREFIX = "recipe-admin-svc-category-";
let sequence = 0;

async function makeRole(grants: { module: AdminModule; action: AdminAction }[]) {
  sequence += 1;
  const role = await prisma.role.create({ data: { key: `${ROLE_KEY_PREFIX}${sequence}`, name: `Recipe Admin Svc Test Role ${sequence}` } });
  if (grants.length > 0) await prisma.rolePermission.createMany({ data: grants.map((grant) => ({ roleId: role.id, ...grant })) });
  return role;
}

async function makeAdminUser(roleId: string) {
  sequence += 1;
  return prisma.adminUser.create({ data: { email: `admin-${sequence}${EMAIL_DOMAIN}`, name: "Test Admin", passwordHash: "unused", roleId } });
}

async function makeFullAccessAdmin() {
  const role = await makeRole([
    { module: "Recipes", action: "View" },
    { module: "Recipes", action: "Edit" },
    { module: "Recipes", action: "Delete" },
    { module: "Recipes", action: "Approve" },
  ]);
  return makeAdminUser(role.id);
}

async function makeCategory() {
  sequence += 1;
  return prisma.recipeCategory.create({ data: { name: `Recipe Admin Test Category ${sequence}`, slug: `${CATEGORY_SLUG_PREFIX}${sequence}` } });
}

function baseInput(categoryId: string, overrides: Partial<RecipeAdminValidatedInput> = {}): RecipeAdminValidatedInput {
  sequence += 1;
  return {
    slug: `recipe-admin-svc-test-${sequence}`,
    title: `Test Recipe ${sequence}`,
    shortDescription: "A short description.",
    heroImage: "/images/test-hero.webp",
    heroImageAlt: "A test hero image",
    galleryImageUrls: [],
    categoryId,
    cuisine: null,
    difficulty: "Easy",
    prepTimeMinutes: 10,
    cookTimeMinutes: 20,
    servings: 4,
    isFeatured: false,
    chefNotes: null,
    nutritionCalories: null,
    nutritionProtein: null,
    nutritionCarbs: null,
    nutritionFat: null,
    nutritionFiber: null,
    nutritionSodium: null,
    videoUrl: null,
    videoProvider: null,
    videoDurationSeconds: null,
    captionsUrl: null,
    dietaryTagIds: [],
    ingredients: [{ quantity: 1, unit: "cup", displayText: "flour", productId: null }],
    steps: [{ instruction: "Mix everything together.", imageUrl: null }],
    ...overrides,
  };
}

afterEach(async () => {
  await prisma.auditLog.deleteMany({ where: { actor: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.recipe.deleteMany({ where: { createdBy: { email: { endsWith: EMAIL_DOMAIN } } } });
  await prisma.adminUser.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
  await prisma.rolePermission.deleteMany({ where: { role: { key: { startsWith: ROLE_KEY_PREFIX } } } });
  await prisma.role.deleteMany({ where: { key: { startsWith: ROLE_KEY_PREFIX } } });
  await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
});

describe("recipe-admin.service", () => {
  it("creates a recipe with ingredients and steps, in Draft status", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(admin.id, baseInput(category.id));

    expect(recipe.status).toBe("Draft");
    expect(recipe.ingredients).toHaveLength(1);
    expect(recipe.steps).toHaveLength(1);

    const log = await prisma.auditLog.findFirst({ where: { actorId: admin.id, action: "recipe_created" } });
    expect(log).not.toBeNull();
  });

  it("rejects a duplicate slug", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const input = baseInput(category.id);
    await createRecipe(admin.id, input);
    await expect(createRecipe(admin.id, { ...baseInput(category.id), slug: input.slug })).rejects.toBeInstanceOf(RecipeAdminSlugConflictError);
  });

  it("update replaces ingredients/steps/dietary tags wholesale", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(admin.id, baseInput(category.id));

    const updated = await updateRecipe(admin.id, recipe.id, baseInput(category.id, { ingredients: [{ quantity: 2, unit: "tbsp", displayText: "sugar", productId: null }], steps: [] }));

    expect(updated.ingredients).toHaveLength(1);
    expect(updated.ingredients[0].displayText).toBe("sugar");
    expect(updated.steps).toHaveLength(0);
  });

  it("full lifecycle: Draft -> Review -> Approved -> Published -> Archived -> Draft", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(admin.id, baseInput(category.id));

    const review = await submitForReview(admin.id, recipe.id);
    expect(review.status).toBe("Review");

    const approved = await approve(admin.id, recipe.id);
    expect(approved.status).toBe("Approved");
    expect(approved.reviewerComment).toBeNull();

    const published = await publish(admin.id, recipe.id);
    expect(published.status).toBe("Published");
    expect(published.publishedAt).not.toBeNull();

    const archived = await archive(admin.id, recipe.id);
    expect(archived.status).toBe("Archived");

    const restored = await restore(admin.id, recipe.id);
    expect(restored.status).toBe("Draft");
  });

  it("reject sends a Review or Approved recipe back to Draft with a visible comment", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(admin.id, baseInput(category.id));
    await submitForReview(admin.id, recipe.id);

    const rejected = await reject(admin.id, recipe.id, "Fix the ingredient list.");
    expect(rejected.status).toBe("Draft");
    expect(rejected.reviewerComment).toBe("Fix the ingredient list.");
  });

  it("rejects Draft -> Published directly (must pass through Review/Approved)", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(admin.id, baseInput(category.id));

    await expect(publish(admin.id, recipe.id)).rejects.toBeInstanceOf(RecipeAdminIllegalTransitionError);
  });

  it("rejects Approved -> Archived directly (must publish first)", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(admin.id, baseInput(category.id));
    await submitForReview(admin.id, recipe.id);
    await approve(admin.id, recipe.id);

    await expect(archive(admin.id, recipe.id)).rejects.toBeInstanceOf(RecipeAdminIllegalTransitionError);
  });

  it("publish-readiness guard rejects a recipe missing a hero image, ingredients, or steps", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();

    const noHero = await createRecipe(admin.id, baseInput(category.id, { heroImage: "", heroImageAlt: "" }));
    await expect(submitForReview(admin.id, noHero.id)).rejects.toBeInstanceOf(RecipePublishReadinessError);

    const noIngredients = await createRecipe(admin.id, baseInput(category.id, { ingredients: [] }));
    await expect(submitForReview(admin.id, noIngredients.id)).rejects.toBeInstanceOf(RecipePublishReadinessError);

    const noSteps = await createRecipe(admin.id, baseInput(category.id, { steps: [] }));
    await expect(submitForReview(admin.id, noSteps.id)).rejects.toBeInstanceOf(RecipePublishReadinessError);
  });

  it("only a Draft recipe can be deleted", async () => {
    const admin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(admin.id, baseInput(category.id));
    await submitForReview(admin.id, recipe.id);

    await expect(deleteRecipe(admin.id, recipe.id)).rejects.toBeInstanceOf(RecipeAdminNotDraftError);

    const draft = await createRecipe(admin.id, baseInput(category.id));
    await deleteRecipe(admin.id, draft.id);
    const found = await prisma.recipe.findUnique({ where: { id: draft.id } });
    expect(found).toBeNull();
  });

  it("denies access to an admin without Recipes permission", async () => {
    const role = await makeRole([]);
    const viewer = await makeAdminUser(role.id);
    const category = await makeCategory();
    await expect(createRecipe(viewer.id, baseInput(category.id))).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("approve/reject/publish require the Approve action specifically, not just Edit", async () => {
    const editOnlyRole = await makeRole([
      { module: "Recipes", action: "View" },
      { module: "Recipes", action: "Edit" },
    ]);
    const editOnlyAdmin = await makeAdminUser(editOnlyRole.id);
    const fullAdmin = await makeFullAccessAdmin();
    const category = await makeCategory();
    const recipe = await createRecipe(fullAdmin.id, baseInput(category.id));
    await submitForReview(fullAdmin.id, recipe.id);

    await expect(approve(editOnlyAdmin.id, recipe.id)).rejects.toBeInstanceOf(PermissionDeniedError);
  });
});
