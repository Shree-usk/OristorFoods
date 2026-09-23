import { afterEach, describe, expect, it, vi } from "vitest";

import { ApiError } from "@/lib/api/api-error";
import { fetchMyQuestions, fetchQuestionPage, postQuestion } from "@/lib/api/question-client";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("question-client", () => {
  it("builds the list URL with q only when set", async () => {
    fetchMock.mockImplementation(async () => json({ items: [], total: 0, page: 1, pageSize: 10 }));

    await fetchQuestionPage("chilli powder", { page: 2, pageSize: 10 });
    await fetchQuestionPage("chilli", { page: 1, pageSize: 10, q: "store it" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli%20powder/questions?page=2&pageSize=10");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("/api/products/chilli/questions?page=1&pageSize=10&q=store+it");
  });

  it("reads the customer's open questions", async () => {
    fetchMock.mockResolvedValue(json({ questions: [] }));

    expect(await fetchMyQuestions("chilli")).toEqual([]);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/questions/mine");
  });

  it("posts a question and throws ApiError with field errors on 400", async () => {
    fetchMock.mockResolvedValue(json({ error: "Too short", fieldErrors: { text: ["Too short"] } }, 400));

    const error = await postQuestion("chilli", { text: "Hot?" }).catch((caught: unknown) => caught);

    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({ method: "POST" });
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 400, fieldErrors: { text: ["Too short"] } });
  });
});
