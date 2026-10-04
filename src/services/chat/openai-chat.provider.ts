import type { ChatCompletionMessage, ChatCompletionProvider, ChatCompletionResult } from "@/services/chat/chat-completion-provider.interface";

/**
 * Real, working implementation — not a stub. Plain `fetch`, not the
 * `openai` SDK, same precedent as openai-embedding.provider.ts.
 * Single attempt, no retry. A longer timeout than the embeddings
 * provider's 2s: this is a generation call, not a sub-500ms search
 * budget item, and there's no AC latency target for the assistant to
 * blow.
 */
const MODEL = "gpt-4o-mini";
const TIMEOUT_MS = 10_000;
const API_URL = "https://api.openai.com/v1/chat/completions";

export class OpenAiChatProvider implements ChatCompletionProvider {
  readonly name = "openai";

  async generateResponse(messages: ChatCompletionMessage[], options: { jsonSchema: Record<string, unknown> }): Promise<ChatCompletionResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: MODEL,
          messages,
          response_format: { type: "json_schema", json_schema: { name: "recipe_assistant_response", strict: true, schema: options.jsonSchema } },
        }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`OpenAI chat completions request failed: ${response.status} ${body}`);
      }
      const data: { choices: { message: { content: string } }[]; usage: { prompt_tokens: number; completion_tokens: number } } = await response.json();
      const content = data.choices[0]?.message.content;
      if (!content) throw new Error("OpenAI chat completions response had no message content");
      return { content, promptTokens: data.usage.prompt_tokens, completionTokens: data.usage.completion_tokens };
    } finally {
      clearTimeout(timeout);
    }
  }
}
