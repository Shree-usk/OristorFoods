import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BlogCommentForm } from "@/components/storefront/blog/blog-comment-form";

const originalFetch = global.fetch;

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("BlogCommentForm", () => {
  it("submits the form and shows the awaiting-approval message, never the submitted comment as if public", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "pending-review" }) }) as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<BlogCommentForm postSlug="a-post" />);

    await user.type(screen.getByLabelText(/name/i), "Nadeesha");
    await user.type(screen.getByLabelText(/email/i), "nadeesha@example.com");
    await user.type(screen.getByLabelText(/comment/i), "This is a lovely, sufficiently long comment.");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument());
    expect(screen.queryByText("This is a lovely, sufficiently long comment.")).not.toBeInTheDocument();
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/blog/a-post/comments",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("shows a validation error and does not submit when the comment body is too short", async () => {
    global.fetch = vi.fn() as unknown as typeof fetch;
    const user = userEvent.setup();
    render(<BlogCommentForm postSlug="a-post" />);

    await user.type(screen.getByLabelText(/name/i), "Nadeesha");
    await user.type(screen.getByLabelText(/email/i), "nadeesha@example.com");
    await user.type(screen.getByLabelText(/comment/i), "hi");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    expect(await screen.findByText(/too short/i)).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("renders the honeypot field hidden from view and from the accessibility tree", () => {
    render(<BlogCommentForm postSlug="a-post" />);
    const honeypot = document.querySelector('input[name="honeypot"]');
    expect(honeypot).not.toBeNull();
    expect(honeypot).toHaveAttribute("aria-hidden", "true");
    expect(honeypot).toHaveAttribute("tabIndex", "-1");
  });
});
