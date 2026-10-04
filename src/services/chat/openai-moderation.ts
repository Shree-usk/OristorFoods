/**
 * STORY-062. A real, working check against OpenAI's own free
 * moderation endpoint — not a fabricated keyword filter, since no
 * content-moderation pattern exists anywhere else in this codebase
 * to mirror. Fails OPEN on a transient error (logs, lets the message
 * through): the output-side grounding guardrail
 * (recipe-assistant.service.ts's candidate-id check) is the harder
 * safety boundary either way, so blocking all chat on a moderation-
 * endpoint hiccup would be the wrong trade.
 */
const TIMEOUT_MS = 3000;
const API_URL = "https://api.openai.com/v1/moderations";

export async function isFlaggedByModeration(text: string): Promise<boolean> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return false;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ input: text }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error(`[recipe-assistant] moderation request failed: ${response.status}`);
      return false;
    }
    const data: { results: { flagged: boolean }[] } = await response.json();
    return data.results[0]?.flagged ?? false;
  } catch (error) {
    console.error("[recipe-assistant] moderation request errored", error);
    return false;
  } finally {
    clearTimeout(timeout);
  }
}
