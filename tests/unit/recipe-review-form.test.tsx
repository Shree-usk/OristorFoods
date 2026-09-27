import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { RecipeReviewForm } = await import("@/components/storefront/recipes/reviews/recipe-review-form");

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal("fetch", fetchMock);

const pending = { id: "r1", rating: 4, reviewText: "Rich and aromatic.", status: "Pending" };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

/** Routes fetch calls by method + URL suffix. Each handler may be called many times. */
function routeFetch(handlers: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    const key = Object.keys(handlers).find((candidate) => {
      const [candidateMethod, suffix] = candidate.split(" ");
      return candidateMethod === method && url.endsWith(suffix ?? "");
    });
    if (!key) throw new Error(`Unexpected fetch: ${method} ${url}`);
    return handlers[key]!();
  });
}

function renderForm() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <RecipeReviewForm recipeSlug="chicken-curry" />
    </QueryClientProvider>,
  );
}

async function fillForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("radio", { name: "4 stars" }));
  await user.type(screen.getByLabelText("Your review (optional)"), "Rich and aromatic.");
}

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
});

afterEach(() => {
  fetchMock.mockReset();
});

describe("RecipeReviewForm", () => {
  it("renders nothing while the session is loading", () => {
    mockUseSession.mockReturnValue({ status: "loading", data: null });

    const { container } = renderForm();

    expect(container).toBeEmptyDOMElement();
  });

  it("asks guests to sign in, returning them to this recipe", () => {
    mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });

    renderForm();

    expect(screen.getByRole("link", { name: "Sign in to write a review" })).toHaveAttribute(
      "href",
      "/account/login?callbackUrl=%2Frecipes%2Fchicken-curry",
    );
  });

  it("validates on the client before submitting (a rating is required, review text is not)", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: null }) });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Please choose a star rating")).toBeInTheDocument();
    expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(false);
  });

  it("submits with no review text and switches to the pending state", async () => {
    routeFetch({
      "GET /reviews/mine": () => json({ review: null }),
      "POST /reviews": () => json({ review: { ...pending, reviewText: null } }, 201),
    });
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("button", { name: "Submit review" });

    await user.click(screen.getByRole("radio", { name: "4 stars" }));
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
    expect(JSON.parse(String(post?.[1]?.body))).toEqual({ rating: 4 });
  });

  it("shows the existing review after a 409 duplicate", async () => {
    let mineCalls = 0;
    routeFetch({
      "GET /reviews/mine": () => {
        mineCalls += 1;
        return json({ review: mineCalls === 1 ? null : pending });
      },
      "POST /reviews": () => json({ error: "You have already reviewed this recipe" }, 409),
    });
    const user = userEvent.setup();
    renderForm();
    await screen.findByRole("button", { name: "Submit review" });

    await fillForm(user);
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
  });

  it("edits a pending review with its values prefilled", async () => {
    routeFetch({
      "GET /reviews/mine": () => json({ review: pending }),
      "PATCH /reviews/r1": () => json({ review: { ...pending, reviewText: "Even better" } }),
    });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Edit review" }));
    expect(screen.getByLabelText("Your review (optional)")).toHaveValue("Rich and aromatic.");
    expect(screen.getByRole("radio", { name: "4 stars" })).toBeChecked();

    const textarea = screen.getByLabelText("Your review (optional)");
    await user.clear(textarea);
    await user.type(textarea, "Even better");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Thanks! Your review is pending approval.")).toBeInTheDocument();
    const patch = fetchMock.mock.calls.find(([, init]) => init?.method === "PATCH");
    expect(String(patch?.[0])).toMatch(/\/api\/recipes\/chicken-curry\/reviews\/r1$/);
  });

  it("withdraws after an inline confirmation, then shows the empty form", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: pending }), "DELETE /reviews/r1": () => new Response(null, { status: 204 }) });
    const user = userEvent.setup();
    renderForm();

    await user.click(await screen.findByRole("button", { name: "Withdraw" }));
    expect(screen.getByText("Withdraw your review? This can't be undone.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, withdraw" }));

    expect(await screen.findByRole("button", { name: "Submit review" })).toBeInTheDocument();
  });

  it("shows a status note, without editing, once past Pending", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ review: { ...pending, status: "Approved" } }) });

    renderForm();

    expect(await screen.findByText("Your review has been approved and is now visible on this recipe.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit review" })).not.toBeInTheDocument();
  });

  it("reports a failed load of the customer's review", async () => {
    routeFetch({ "GET /reviews/mine": () => json({ error: "boom" }, 500) });

    renderForm();

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't load your review"));
  });
});
