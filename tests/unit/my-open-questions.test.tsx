import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { MyOpenQuestions } = await import("@/components/storefront/product/questions/my-open-questions");

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function renderIt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MyOpenQuestions productSlug="curry" />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  fetchMock.mockReset();
});

describe("MyOpenQuestions", () => {
  it("renders nothing and doesn't fetch for guests", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    expect(renderIt().container).toBeEmptyDOMElement();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("lists the customer's open questions", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ questions: [{ id: "q1", text: "Is it organic?", status: "Pending", createdAt: "2026-09-23T00:00:00.000Z" }] }),
        { status: 200 },
      ),
    );

    renderIt();

    expect(await screen.findByRole("heading", { name: "Your questions awaiting an answer" })).toBeInTheDocument();
    expect(screen.getByText("Is it organic?")).toBeInTheDocument();
  });

  it("renders nothing when the customer has none", async () => {
    mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ questions: [] }), { status: 200 }));

    const { container } = renderIt();

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
