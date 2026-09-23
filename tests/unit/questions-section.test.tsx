import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/react", () => ({ useSession: () => ({ status: "unauthenticated", data: null }) }));

import { QuestionsSection } from "@/components/storefront/product/questions/questions-section";
import type { QaSummary } from "@/services/product-detail-extensions";
import type { PublicQuestion } from "@/types/question";

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function qa(id: string, question: string, answer = "An answer."): PublicQuestion {
  return { id, question, answer, publishedAt: "2026-09-01T00:00:00.000Z" };
}

const summary: QaSummary = {
  totalCount: 2,
  previewItems: [qa("q1", "How should I store it?", "In an airtight jar."), qa("q2", "Is it very hot?", "Medium heat.")],
};

function renderSection(value: QaSummary | null = summary) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <QuestionsSection productSlug="chilli" summary={value} />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("QuestionsSection", () => {
  it("renders the server-provided first page without fetching", () => {
    renderSection();

    expect(screen.getByRole("heading", { level: 2, name: "Questions & Answers" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 3, name: "How should I store it?" })).toBeInTheDocument();
    expect(screen.getByText("In an airtight jar.")).toBeInTheDocument();
    expect(screen.getByText("Showing 1–2 of 2 questions")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the empty state when there are no questions", () => {
    renderSection(null);

    expect(screen.getByText("No questions yet. Be the first to ask.")).toBeInTheDocument();
  });

  it("searches after typing and shows a no-match message", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [], total: 0, page: 1, pageSize: 10 }), { status: 200 }));
    renderSection();

    await userEvent.type(screen.getByLabelText("Search questions about this product"), "delivery");

    expect(await screen.findByText("No questions match “delivery”. Ask it below.")).toBeInTheDocument();
    await waitFor(() =>
      expect(fetchMock.mock.calls.at(-1)?.[0]).toBe("/api/products/chilli/questions?page=1&pageSize=10&q=delivery"),
    );
  });

  it("pages forward with Next", async () => {
    fetchMock.mockImplementation(
      async () => new Response(JSON.stringify({ items: [qa("q11", "Page two question?")], total: 12, page: 2, pageSize: 10 }), { status: 200 }),
    );
    renderSection({ ...summary, totalCount: 12 });

    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    expect(await screen.findByRole("heading", { name: "Page two question?" })).toBeInTheDocument();
    expect(fetchMock.mock.calls[0]?.[0]).toBe("/api/products/chilli/questions?page=2&pageSize=10");
  });
});
