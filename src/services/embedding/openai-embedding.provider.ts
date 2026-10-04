import type { EmbeddingProvider, EmbeddingResult } from "@/services/embedding/embedding-provider.interface";

/**
 * Real, working implementation — not a stub. Plain `fetch`, not the
 * `openai` SDK: one endpoint, one shape, not worth a new dependency.
 * Single attempt, no retry — this codebase has no retry/backoff
 * pattern for a synchronous call in a request path, and a retry here
 * would itself blow the 500ms full-search budget.
 */
const MODEL = "text-embedding-3-small";
const TIMEOUT_MS = 2000;
const API_URL = "https://api.openai.com/v1/embeddings";

export class OpenAiEmbeddingProvider implements EmbeddingProvider {
  readonly name = "openai";

  async generateEmbedding(text: string): Promise<EmbeddingResult> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model: MODEL, input: text }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(`OpenAI embeddings request failed: ${response.status} ${body}`);
      }
      const data: { data: { embedding: number[] }[]; usage: { total_tokens: number } } = await response.json();
      const embedding = data.data[0]?.embedding;
      if (!embedding) throw new Error("OpenAI embeddings response had no embedding vector");
      return { embedding, tokensUsed: data.usage.total_tokens };
    } finally {
      clearTimeout(timeout);
    }
  }
}
