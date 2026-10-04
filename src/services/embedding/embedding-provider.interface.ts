/**
 * STORY-061. Deliberately narrow — embeddings only, not a general
 * chat/completion abstraction. There's no free/local substitute for a
 * real embedding provider (unlike notification-provider.interface.ts's
 * email, which always succeeds via an Ethereal sandbox fallback), so
 * this throws on any failure rather than faking a result; the caller
 * (smart-search.service.ts) catches once and skips the semantic layer
 * entirely, falling back to keyword search — see
 * docs/architecture-decisions.md.
 */

export interface EmbeddingResult {
  embedding: number[];
  /** OpenAI's own reported usage.total_tokens — real cost-observability data, not an estimate. */
  tokensUsed: number;
}

export interface EmbeddingProvider {
  readonly name: string;
  generateEmbedding(text: string): Promise<EmbeddingResult>;
}
