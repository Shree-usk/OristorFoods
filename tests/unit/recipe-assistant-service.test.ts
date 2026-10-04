// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import { createProduct } from "@/repositories/product.repository";
import { createStandardPrice } from "@/repositories/pricing.repository";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import type { ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";
import { RecipeAssistantConversationNotFoundError } from "@/services/recipe-assistant.errors";
import { getConversation, sendMessage, setRecipeAssistantProvidersForTesting } from "@/services/recipe-assistant.service";

const EMAIL_DOMAIN = "@recipe-assistant-svc-test.test";
const SKU_PREFIX = "RECIPE-ASSISTANT-SVC-SKU-";
const RECIPE_SLUG_PREFIX = "recipe-assistant-svc-recipe-";
const CATEGORY_SLUG_PREFIX = "recipe-assistant-svc-category-";
const ORDER_PREFIX = "RECIPE-ASSISTANT-SVC-ORDER-";
let sequence = 0;

function fakeEmbeddingProvider(): EmbeddingProvider {
  return { name: "fake", generateEmbedding: async () => ({ embedding: Array.from({ length: 1536 }, () => 0), tokensUsed: 1 }) };
}

function fakeChatProvider(response: { message: string; recommendedRecipeIds: string[]; clarifyingQuestion: string | null }): ChatCompletionProvider {
  return {
    name: "fake",
    generateResponse: async () => ({ content: JSON.stringify(response), promptTokens: 10, completionTokens: 5 }),
  };
}

function throwingChatProvider(): ChatCompletionProvider {
  return { name: "fake", generateResponse: async () => { throw new Error("simulated provider failure"); } };
}

async function makeProduct(name: string) {
  sequence += 1;
  const product = await createProduct({ sku: `${SKU_PREFIX}${sequence}`, slug: `recipe-assistant-svc-product-${sequence}`, name, status: "Published", stockQuantity: 10 });
  await createStandardPrice({ product: { connect: { id: product.id } }, price: "100.00" });
  return product;
}

async function makeRecipe(title: string, productIds: string[]) {
  sequence += 1;
  const category = await prisma.recipeCategory.create({ data: { name: `Recipe Assistant Svc Category ${sequence}`, slug: `${CATEGORY_SLUG_PREFIX}${sequence}` } });
  return prisma.recipe.create({
    data: {
      slug: `${RECIPE_SLUG_PREFIX}${sequence}`,
      title,
      shortDescription: "A test recipe.",
      heroImage: "/placeholder.jpg",
      heroImageAlt: "placeholder",
      categoryId: category.id,
      difficulty: "Easy",
      prepTimeMinutes: 5,
      cookTimeMinutes: 5,
      totalTimeMinutes: 10,
      servings: 2,
      status: "Published",
      ingredients: { create: productIds.map((productId, index) => ({ productId, displayText: `Ingredient ${index}`, sortOrder: index })) },
    },
  });
}

async function makeCustomer() {
  sequence += 1;
  return prisma.user.create({ data: { email: `customer-${sequence}${EMAIL_DOMAIN}` } });
}

async function makeOrderFor(userId: string, productIds: string[]) {
  sequence += 1;
  const total = productIds.length * 100;
  return prisma.order.create({
    data: {
      orderNumber: `${ORDER_PREFIX}${sequence}`,
      idempotencyKey: `idem-${ORDER_PREFIX}${sequence}`,
      userId,
      status: "Confirmed",
      subtotal: total.toFixed(2),
      deliveryCharge: "0.00",
      grandTotal: total.toFixed(2),
      deliveryZoneName: "Western",
      shipRecipientName: "Test Customer",
      shipPhone: "+94 77 123 4567",
      shipLine1: "10 Test Lane",
      shipCity: "Colombo",
      items: {
        create: productIds.map((productId) => ({ productId, productName: "x", productSku: "x", unitPrice: "100.00", quantity: 1, lineTotal: "100.00" })),
      },
    },
  });
}

afterEach(async () => {
  setRecipeAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });
  await prisma.recipeAssistantMessage.deleteMany();
  await prisma.recipeAssistantConversation.deleteMany();
  await prisma.orderItem.deleteMany({ where: { order: { orderNumber: { startsWith: ORDER_PREFIX } } } });
  await prisma.order.deleteMany({ where: { orderNumber: { startsWith: ORDER_PREFIX } } });
  await prisma.recipe.deleteMany({ where: { slug: { startsWith: RECIPE_SLUG_PREFIX } } });
  await prisma.recipeCategory.deleteMany({ where: { slug: { startsWith: CATEGORY_SLUG_PREFIX } } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: SKU_PREFIX } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: EMAIL_DOMAIN } } });
});

describe("recipe-assistant.service — guardrail", () => {
  it("strips a recommended recipe id the provider invented outside the candidate set", async () => {
    const owned = await makeProduct("Recipe Assistant Svc Curry Powder");
    const recipe = await makeRecipe("Recipe Assistant Svc Curry Dish", [owned.id]);
    setRecipeAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: fakeChatProvider({ message: "Here's a curry!", recommendedRecipeIds: [recipe.id, "not-a-real-id"], clarifyingQuestion: null }),
      moderation: async () => false,
    });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session", message: "curry dish", filters: { dietaryTagSlugs: [], categorySlug: null } });

    expect(result.recipes.map((r) => r.id)).toEqual([recipe.id]);
  });
});

describe("recipe-assistant.service — product-gap analysis", () => {
  it("splits already-owned vs needs-to-buy products for a customer with purchase history", async () => {
    const owned = await makeProduct("Recipe Assistant Svc Owned Product");
    const needed = await makeProduct("Recipe Assistant Svc Needed Product");
    const recipe = await makeRecipe("Recipe Assistant Svc Gap Dish", [owned.id, needed.id]);
    const customer = await makeCustomer();
    await makeOrderFor(customer.id, [owned.id]);
    setRecipeAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: fakeChatProvider({ message: "Try this!", recommendedRecipeIds: [recipe.id], clarifyingQuestion: null }),
      moderation: async () => false,
    });

    const result = await sendMessage({ conversationId: null, customerId: customer.id, sessionId: null, message: "gap dish", filters: { dietaryTagSlugs: [], categorySlug: null } });

    const card = result.recipes[0];
    expect(card.productsOwned.map((p) => p.id)).toEqual([owned.id]);
    expect(card.productsNeeded.map((p) => p.id)).toEqual([needed.id]);
  });

  it("treats a guest as needing every product, since there is no purchase history", async () => {
    const product = await makeProduct("Recipe Assistant Svc Guest Product");
    const recipe = await makeRecipe("Recipe Assistant Svc Guest Dish", [product.id]);
    setRecipeAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: fakeChatProvider({ message: "Try this!", recommendedRecipeIds: [recipe.id], clarifyingQuestion: null }),
      moderation: async () => false,
    });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session-2", message: "guest dish", filters: { dietaryTagSlugs: [], categorySlug: null } });

    expect(result.recipes[0].productsNeeded.map((p) => p.id)).toEqual([product.id]);
    expect(result.recipes[0].productsOwned).toEqual([]);
  });
});

describe("recipe-assistant.service — moderation short-circuit", () => {
  it("declines without calling the chat provider when the message is flagged", async () => {
    let chatProviderCalled = false;
    setRecipeAssistantProvidersForTesting({
      embedding: fakeEmbeddingProvider(),
      chat: { name: "fake", generateResponse: async () => { chatProviderCalled = true; throw new Error("should not be called"); } },
      moderation: async () => true,
    });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session-3", message: "anything", filters: { dietaryTagSlugs: [], categorySlug: null } });

    expect(chatProviderCalled).toBe(false);
    expect(result.recipes).toEqual([]);
    expect(result.message).toContain("recipes");
  });
});

describe("recipe-assistant.service — graceful fallback on provider failure", () => {
  it("returns a fallback message instead of throwing when the chat provider fails", async () => {
    setRecipeAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });

    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "guest-session-4", message: "anything", filters: { dietaryTagSlugs: [], categorySlug: null } });

    expect(result.recipes).toEqual([]);
    expect(result.message.toLowerCase()).toContain("trouble");
  });
});

describe("recipe-assistant.service — conversation ownership", () => {
  it("rejects fetching a conversation with the wrong session id", async () => {
    setRecipeAssistantProvidersForTesting({ embedding: fakeEmbeddingProvider(), chat: throwingChatProvider(), moderation: async () => false });
    const result = await sendMessage({ conversationId: null, customerId: null, sessionId: "owner-session", message: "hello", filters: { dietaryTagSlugs: [], categorySlug: null } });

    await expect(getConversation(result.conversationId, null, "a-different-session")).rejects.toBeInstanceOf(RecipeAssistantConversationNotFoundError);
    await expect(getConversation(result.conversationId, null, "owner-session")).resolves.not.toBeNull();
  });
});
