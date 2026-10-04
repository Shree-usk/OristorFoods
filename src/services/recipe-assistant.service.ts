import type { RecipeDetailRow } from "@/repositories/recipe.repository";
import * as recipeAssistantRepository from "@/repositories/recipe-assistant.repository";
import * as recipeRepository from "@/repositories/recipe.repository";
import * as embeddingRepository from "@/repositories/embedding.repository";
import { getPurchasedProductIds } from "@/repositories/recommendation.repository";
import { OpenAiEmbeddingProvider } from "@/services/embedding/openai-embedding.provider";
import type { EmbeddingProvider } from "@/services/embedding/embedding-provider.interface";
import { OpenAiChatProvider } from "@/services/chat/openai-chat.provider";
import type { ChatCompletionMessage, ChatCompletionProvider } from "@/services/chat/chat-completion-provider.interface";
import { isFlaggedByModeration as defaultIsFlaggedByModeration } from "@/services/chat/openai-moderation";
import { RecipeAssistantConversationNotFoundError } from "@/services/recipe-assistant.errors";

/**
 * STORY-062. Orchestrates the Recipe Assistant's retrieve → ground →
 * generate → validate flow. No raw token streaming (see
 * docs/architecture-decisions.md): retrieval runs first against real
 * catalogue data, the LLM is constrained to a JSON schema that can
 * only reference the candidate ids it was given, and a guardrail
 * re-verifies every returned id before this function returns —
 * showing partial tokens before that guardrail runs would defeat it.
 */

const CANDIDATE_LIMIT = 6;
const HISTORY_LIMIT = 10;
const FALLBACK_MESSAGE = "I'm having trouble finding recipes right now — please browse the Recipe Centre instead while I sort this out.";
const DECLINE_MESSAGE = "I can't help with that — I'm here to help you find Oristor recipes. Try asking about ingredients you have, a dietary need, or an occasion.";

let embeddingProvider: EmbeddingProvider = new OpenAiEmbeddingProvider();
let chatProvider: ChatCompletionProvider = new OpenAiChatProvider();
let isFlaggedByModeration: (text: string) => Promise<boolean> = defaultIsFlaggedByModeration;

/** Test-only seams — mirror smart-search.service.ts's own pattern. */
export function setRecipeAssistantProvidersForTesting(providers: {
  embedding?: EmbeddingProvider;
  chat?: ChatCompletionProvider;
  moderation?: (text: string) => Promise<boolean>;
}) {
  if (providers.embedding) embeddingProvider = providers.embedding;
  if (providers.chat) chatProvider = providers.chat;
  if (providers.moderation) isFlaggedByModeration = providers.moderation;
}

const RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    message: { type: "string" },
    recommendedRecipeIds: { type: "array", items: { type: "string" } },
    clarifyingQuestion: { type: ["string", "null"] },
  },
  required: ["message", "recommendedRecipeIds", "clarifyingQuestion"],
  additionalProperties: false,
} as const;

interface StructuredResponse {
  message: string;
  recommendedRecipeIds: string[];
  clarifyingQuestion: string | null;
}

export interface SendMessageFilters {
  dietaryTagSlugs: string[];
  categorySlug: string | null;
}

export interface SendMessageInput {
  conversationId: string | null;
  customerId: string | null;
  sessionId: string | null;
  message: string;
  filters: SendMessageFilters;
}

export interface ProductRef {
  id: string;
  slug: string;
  name: string;
}

export interface RecipeGapCard {
  id: string;
  slug: string;
  title: string;
  heroImage: string;
  totalTimeMinutes: number;
  difficulty: string;
  productsOwned: ProductRef[];
  productsNeeded: ProductRef[];
}

export interface SendMessageResult {
  conversationId: string;
  message: string;
  recipes: RecipeGapCard[];
  clarifyingQuestion: string | null;
}

async function resolveConversationId(input: SendMessageInput): Promise<string> {
  if (!input.conversationId) {
    const created = await recipeAssistantRepository.createConversation(input.customerId, input.sessionId);
    return created.id;
  }
  const existing = await recipeAssistantRepository.findConversationById(input.conversationId);
  const owns = existing && ((input.customerId && existing.customerId === input.customerId) || (input.sessionId && existing.sessionId === input.sessionId));
  if (!owns) throw new RecipeAssistantConversationNotFoundError();
  return existing.id;
}

async function retrieveCandidates(message: string, filters: SendMessageFilters): Promise<RecipeDetailRow[]> {
  const where = recipeRepository.buildRecipeWhere({ diet: filters.dietaryTagSlugs, category: filters.categorySlug ?? undefined, q: message });
  const [keywordMatches, embeddingResult] = await Promise.all([
    recipeRepository.findPublishedRecipes({ where, orderBy: [{ viewCount: "desc" }], skip: 0, take: CANDIDATE_LIMIT }),
    embeddingProvider.generateEmbedding(message).catch(() => null),
  ]);

  const ids = keywordMatches.rows.map((row) => row.id);
  if (embeddingResult) {
    const semanticMatches = await embeddingRepository.findSimilarContentIds(embeddingResult.embedding, "Recipe", CANDIDATE_LIMIT);
    const seen = new Set(ids);
    for (const match of semanticMatches) {
      if (!seen.has(match.id)) {
        ids.push(match.id);
        seen.add(match.id);
      }
    }
  }

  return recipeRepository.findRecipeDetailsForAssistant(ids.slice(0, CANDIDATE_LIMIT));
}

function toProductRef(product: { id: string; slug: string; name: string }): ProductRef {
  return { id: product.id, slug: product.slug, name: product.name };
}

function buildGapCard(recipe: RecipeDetailRow, purchasedProductIds: Set<string>): RecipeGapCard {
  const productsOwned: ProductRef[] = [];
  const productsNeeded: ProductRef[] = [];
  const seen = new Set<string>();
  for (const ingredient of recipe.ingredients) {
    if (!ingredient.product || seen.has(ingredient.product.id)) continue;
    seen.add(ingredient.product.id);
    (purchasedProductIds.has(ingredient.product.id) ? productsOwned : productsNeeded).push(toProductRef(ingredient.product));
  }
  return {
    id: recipe.id,
    slug: recipe.slug,
    title: recipe.title,
    heroImage: recipe.heroImage,
    totalTimeMinutes: recipe.totalTimeMinutes,
    difficulty: recipe.difficulty,
    productsOwned,
    productsNeeded,
  };
}

function buildCandidateContext(candidates: RecipeDetailRow[], gapCards: Map<string, RecipeGapCard>): string {
  return JSON.stringify(
    candidates.map((recipe) => {
      const gap = gapCards.get(recipe.id)!;
      return {
        id: recipe.id,
        title: recipe.title,
        shortDescription: recipe.shortDescription,
        difficulty: recipe.difficulty,
        totalTimeMinutes: recipe.totalTimeMinutes,
        dietaryTags: recipe.dietaryTags.map((t) => t.dietaryTag.name),
        productsNeeded: gap.productsNeeded.map((p) => p.name),
        productsAlreadyOwned: gap.productsOwned.map((p) => p.name),
      };
    }),
  );
}

const SYSTEM_PROMPT = `You are Oristor's Recipe Assistant, a friendly cooking guide for Oristor Food Products, a Sri Lankan food brand.
Help customers find recipes based on ingredients they have, dietary needs, or an occasion, and tell them which Oristor products they still need to buy.
You must ONLY recommend recipes from the candidate list given to you in the next message — never invent or reference a recipe that is not in that list, by any name or id.
If none of the candidates are a good match, set recommendedRecipeIds to an empty array and ask a clarifying question instead.
Keep your message conversational, concise, and friendly. Do not repeat the raw candidate data back verbatim — summarize naturally.`;

async function generateStructuredResponse(history: ChatCompletionMessage[], candidateContext: string, userMessage: string): Promise<{ parsed: StructuredResponse; promptTokens: number; completionTokens: number }> {
  const messages: ChatCompletionMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "system", content: `Candidate recipes (JSON): ${candidateContext}` },
    ...history,
    { role: "user", content: userMessage },
  ];
  const result = await chatProvider.generateResponse(messages, { jsonSchema: RESPONSE_SCHEMA });
  const parsed = JSON.parse(result.content) as StructuredResponse;
  return { parsed, promptTokens: result.promptTokens, completionTokens: result.completionTokens };
}

export async function sendMessage(input: SendMessageInput): Promise<SendMessageResult> {
  const conversationId = await resolveConversationId(input);

  await recipeAssistantRepository.createMessage({ conversationId, role: "User", content: input.message });

  if (await isFlaggedByModeration(input.message)) {
    await recipeAssistantRepository.createMessage({ conversationId, role: "Assistant", content: DECLINE_MESSAGE });
    await recipeAssistantRepository.touchConversation(conversationId);
    return { conversationId, message: DECLINE_MESSAGE, recipes: [], clarifyingQuestion: null };
  }

  try {
    const [candidates, purchasedProductIds, recentMessages] = await Promise.all([
      retrieveCandidates(input.message, input.filters),
      input.customerId ? getPurchasedProductIds(input.customerId) : Promise.resolve(new Set<string>()),
      recipeAssistantRepository.findRecentMessages(conversationId, HISTORY_LIMIT),
    ]);

    const gapCards = new Map(candidates.map((recipe) => [recipe.id, buildGapCard(recipe, purchasedProductIds)]));
    const candidateContext = buildCandidateContext(candidates, gapCards);
    const history: ChatCompletionMessage[] = recentMessages
      .slice()
      .reverse()
      .map((row) => ({ role: row.role === "User" ? "user" : "assistant", content: row.content }));

    const { parsed, promptTokens, completionTokens } = await generateStructuredResponse(history, candidateContext, input.message);

    // Guardrail: only trust ids that were actually in the candidate set given (defense in depth
    // beyond the schema constraint), AND re-verify they're still Published right now — a fresh,
    // cheap read that closes the retrieval→generation race (a candidate could have been
    // unpublished in the moments between retrieval and the LLM call returning).
    const candidateIds = new Set(candidates.map((recipe) => recipe.id));
    const schemaValidIds = parsed.recommendedRecipeIds.filter((id) => candidateIds.has(id));
    const stillPublished = new Set((await recipeRepository.findRecipeDetailsForAssistant(schemaValidIds)).map((recipe) => recipe.id));
    const validRecipeIds = schemaValidIds.filter((id) => stillPublished.has(id));

    await recipeAssistantRepository.createMessage({
      conversationId,
      role: "Assistant",
      content: parsed.message,
      structuredPayload: { message: parsed.message, recommendedRecipeIds: validRecipeIds, clarifyingQuestion: parsed.clarifyingQuestion },
      promptTokens,
      completionTokens,
    });
    await recipeAssistantRepository.touchConversation(conversationId);

    return {
      conversationId,
      message: parsed.message,
      recipes: validRecipeIds.map((id) => gapCards.get(id)!),
      clarifyingQuestion: parsed.clarifyingQuestion,
    };
  } catch (error) {
    console.error("[recipe-assistant] failed to generate a response", error);
    await recipeAssistantRepository.createMessage({ conversationId, role: "Assistant", content: FALLBACK_MESSAGE });
    await recipeAssistantRepository.touchConversation(conversationId);
    return { conversationId, message: FALLBACK_MESSAGE, recipes: [], clarifyingQuestion: null };
  }
}

export async function getConversation(id: string, customerId: string | null, sessionId: string | null) {
  const conversation = await recipeAssistantRepository.findConversationById(id);
  const owns = conversation && ((customerId && conversation.customerId === customerId) || (sessionId && conversation.sessionId === sessionId));
  if (!owns) throw new RecipeAssistantConversationNotFoundError();
  return recipeAssistantRepository.findConversationMessages(id);
}
