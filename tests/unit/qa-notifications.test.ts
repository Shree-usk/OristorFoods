// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  notifyQuestionPublished,
  notifyQuestionSubmitted,
  registerQaNotifier,
  resetQaNotifierForTesting,
  type QuestionPublishedEvent,
  type QuestionSubmittedEvent,
} from "@/services/qa-notifications";

const submitted: QuestionSubmittedEvent = {
  questionId: "q1",
  productId: "p1",
  productSlug: "chilli-powder-100g",
  productName: "Chilli Powder 100g",
  text: "Is it very hot?",
  askedByUserId: "u1",
  submittedAt: new Date("2026-09-23T10:00:00Z"),
};

const published: QuestionPublishedEvent = {
  questionId: "q1",
  productId: "p1",
  productSlug: "chilli-powder-100g",
  productName: "Chilli Powder 100g",
  askedByUserId: "u1",
  publishedAt: new Date("2026-09-24T10:00:00Z"),
};

afterEach(() => {
  resetQaNotifierForTesting();
  vi.restoreAllMocks();
});

describe("default notifier", () => {
  it("logs a [qa-notify] line for each event (temporary fallback until STORY-032)", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});

    await notifyQuestionSubmitted(submitted);
    await notifyQuestionPublished(published);

    expect(info).toHaveBeenCalledTimes(2);
    expect(String(info.mock.calls[0]?.[0])).toMatch(/^\[qa-notify\] question submitted/);
    expect(String(info.mock.calls[1]?.[0])).toMatch(/^\[qa-notify\] question published/);
  });
});

describe("registered notifier", () => {
  it("receives the events", async () => {
    const onQuestionSubmitted = vi.fn(async () => {});
    const onQuestionPublished = vi.fn(async () => {});
    registerQaNotifier({ onQuestionSubmitted, onQuestionPublished });

    await notifyQuestionSubmitted(submitted);
    await notifyQuestionPublished(published);

    expect(onQuestionSubmitted).toHaveBeenCalledWith(submitted);
    expect(onQuestionPublished).toHaveBeenCalledWith(published);
  });

  it("never throws into the caller when the notifier fails", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    registerQaNotifier({
      onQuestionSubmitted: async () => {
        throw new Error("SMS gateway down");
      },
      onQuestionPublished: async () => {
        throw new Error("SMS gateway down");
      },
    });

    await expect(notifyQuestionSubmitted(submitted)).resolves.toBeUndefined();
    await expect(notifyQuestionPublished(published)).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("is shared across separately loaded copies of the module", async () => {
    // STORY-032 registers from src/instrumentation.ts, which Next.js bundles
    // separately from route code, so the registry must live on globalThis.
    const first = await import("@/services/qa-notifications");
    vi.resetModules();
    const second = await import("@/services/qa-notifications");
    expect(second).not.toBe(first);
    const onQuestionSubmitted = vi.fn(async () => {});
    first.registerQaNotifier({ onQuestionSubmitted, onQuestionPublished: async () => {} });

    await second.notifyQuestionSubmitted(submitted);

    expect(onQuestionSubmitted).toHaveBeenCalledOnce();
  });
});
