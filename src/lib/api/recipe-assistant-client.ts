/** STORY-062. Fetch wrappers for /api/ai/recipe-assistant/*. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export interface RecipeAssistantProductRef {
  id: string;
  slug: string;
  name: string;
}

export interface RecipeAssistantRecipeCard {
  id: string;
  slug: string;
  title: string;
  heroImage: string;
  totalTimeMinutes: number;
  difficulty: string;
  productsOwned: RecipeAssistantProductRef[];
  productsNeeded: RecipeAssistantProductRef[];
}

export interface RecipeAssistantFilters {
  dietaryTagSlugs: string[];
  categorySlug: string | null;
}

export interface SendRecipeAssistantMessageResult {
  conversationId: string;
  message: string;
  recipes: RecipeAssistantRecipeCard[];
  clarifyingQuestion: string | null;
}

export async function sendRecipeAssistantMessage(
  conversationId: string | null,
  message: string,
  filters: RecipeAssistantFilters,
): Promise<SendRecipeAssistantMessageResult> {
  const response = await fetch("/api/ai/recipe-assistant/message", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, message, filters }),
  });
  await assertOkWithServerMessage(response, "Failed to send your message. Please try again.");
  return response.json();
}

export interface RecipeAssistantMessageRow {
  id: string;
  role: "User" | "Assistant";
  content: string;
  createdAt: string;
}

export async function fetchRecipeAssistantConversation(conversationId: string): Promise<RecipeAssistantMessageRow[]> {
  const response = await fetch(`/api/ai/recipe-assistant/conversations/${conversationId}`);
  if (response.status === 404) return [];
  await assertOkWithServerMessage(response, "Failed to load the conversation.");
  const body: { messages: RecipeAssistantMessageRow[] } = await response.json();
  return body.messages;
}
