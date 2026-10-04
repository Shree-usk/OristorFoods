/**
 * STORY-062. Deliberately narrow — structured chat completions for
 * the Recipe Assistant only, not a general multi-provider gateway
 * (the user explicitly deferred that cross-story question past this
 * story — see docs/architecture-decisions.md). Mirrors
 * embedding-provider.interface.ts's own shape: throws on any
 * failure, the caller (recipe-assistant.service.ts) catches once and
 * falls back to a graceful "having trouble" reply.
 */

export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionResult {
  /** Raw JSON string matching the caller's requested schema — the caller parses it. */
  content: string;
  promptTokens: number;
  completionTokens: number;
}

export interface ChatCompletionProvider {
  readonly name: string;
  generateResponse(messages: ChatCompletionMessage[], options: { jsonSchema: Record<string, unknown> }): Promise<ChatCompletionResult>;
}
