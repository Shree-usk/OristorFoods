import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { AskQuestionForm } = await import("@/components/storefront/product/questions/ask-question-form");

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AskQuestionForm productSlug="curry" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("AskQuestionForm", () => {
  it("renders nothing while the session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });

    expect(renderForm().container).toBeEmptyDOMElement();
  });

  it("asks guests to sign in, returning them to this product", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    renderForm();

    expect(screen.getByRole("link", { name: "Sign in to ask a question" })).toHaveAttribute(
      "href",
      "/account/login?callbackUrl=%2Fproducts%2Fcurry",
    );
  });

  it("validates on the client and doesn't post a too-short question", async () => {
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Your question"), "Hot?");
    await user.click(screen.getByRole("button", { name: "Submit question" }));

    expect(await screen.findByText("Question must be at least 10 characters")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits, confirms, clears the box and shows the character count", async () => {
    fetchMock.mockResolvedValue(
      json({ question: { id: "q1", text: "Is it organic?", status: "Pending", createdAt: "2026-09-23T00:00:00.000Z" } }, 201),
    );
    const user = userEvent.setup();
    renderForm();
    const box = screen.getByLabelText("Your question");

    await user.type(box, "Is it organic?");
    expect(screen.getByText("14/500")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Submit question" }));

    expect(await screen.findByText("Thanks! Your question was submitted and is pending review.")).toBeInTheDocument();
    expect(box).toHaveValue("");
    const post = fetchMock.mock.calls[0];
    expect(post?.[0]).toBe("/api/products/curry/questions");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ text: "Is it organic?" });
  });

  it("shows a server field error", async () => {
    fetchMock.mockResolvedValue(json({ error: "Not allowed", fieldErrors: { text: ["Not allowed"] } }, 400));
    const user = userEvent.setup();
    renderForm();

    await user.type(screen.getByLabelText("Your question"), "Is it organic?");
    await user.click(screen.getByRole("button", { name: "Submit question" }));

    expect(await screen.findByText("Not allowed")).toBeInTheDocument();
  });
});
