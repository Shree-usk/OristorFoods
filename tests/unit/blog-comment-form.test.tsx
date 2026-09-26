import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSession = vi.fn();
vi.mock("next-auth/react", () => ({ useSession: () => mockUseSession() }));

const { BlogCommentForm } = await import("@/components/storefront/blog/blog-comment-form");

const originalFetch = global.fetch;

beforeEach(() => {
  mockUseSession.mockReturnValue({ status: "unauthenticated", data: null });
});

afterEach(() => {
  global.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("BlogCommentForm", () => {
  describe("guest (unauthenticated)", () => {
    it("submits the form and shows the awaiting-approval message, never the submitted comment as if public", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "pending-review" }) }) as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<BlogCommentForm postSlug="a-post" />);

      await user.type(screen.getByLabelText(/name/i), "Nadeesha");
      await user.type(screen.getByLabelText(/email/i), "nadeesha@example.com");
      await user.type(screen.getByLabelText(/comment/i), "This is a lovely, sufficiently long comment.");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      const success = await screen.findByText(/awaiting approval/i);
      expect(success).toHaveAttribute("role", "status");
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

    it("requires name and email for a guest before submitting", async () => {
      global.fetch = vi.fn() as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<BlogCommentForm postSlug="a-post" />);

      await user.type(screen.getByLabelText(/comment/i), "This is a lovely, sufficiently long comment.");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      expect(await screen.findByText("Name is required")).toBeInTheDocument();
      expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("renders the honeypot field hidden from view and from the accessibility tree", () => {
      render(<BlogCommentForm postSlug="a-post" />);
      const honeypot = document.querySelector('input[name="honeypot"]');
      expect(honeypot).not.toBeNull();
      expect(honeypot).toHaveAttribute("aria-hidden", "true");
      expect(honeypot).toHaveAttribute("tabIndex", "-1");
    });

    it("shows a root error and not the success message when the request fails validation server-side", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: "Invalid input", fieldErrors: { email: ["Enter a valid email address"] } }),
      }) as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<BlogCommentForm postSlug="a-post" />);

      await user.type(screen.getByLabelText(/name/i), "Nadeesha");
      await user.type(screen.getByLabelText(/email/i), "nadeesha@example.com");
      await user.type(screen.getByLabelText(/comment/i), "This is a lovely, sufficiently long comment.");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      expect(await screen.findByText("Enter a valid email address")).toBeInTheDocument();
      expect(screen.queryByText(/awaiting approval/i)).not.toBeInTheDocument();
    });

    it("shows a root error, not the success message, when the post is gone (404) at submit time", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ error: "Post not found" }),
      }) as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<BlogCommentForm postSlug="a-post" />);

      await user.type(screen.getByLabelText(/name/i), "Nadeesha");
      await user.type(screen.getByLabelText(/email/i), "nadeesha@example.com");
      await user.type(screen.getByLabelText(/comment/i), "This is a lovely, sufficiently long comment.");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      const alert = await screen.findByText("Post not found");
      expect(alert).toHaveAttribute("role", "alert");
      expect(screen.queryByText(/awaiting approval/i)).not.toBeInTheDocument();
    });

    it("shows a generic root error, not the success message, on a network-level rejection", async () => {
      global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch")) as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<BlogCommentForm postSlug="a-post" />);

      await user.type(screen.getByLabelText(/name/i), "Nadeesha");
      await user.type(screen.getByLabelText(/email/i), "nadeesha@example.com");
      await user.type(screen.getByLabelText(/comment/i), "This is a lovely, sufficiently long comment.");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/something went wrong/i);
      expect(screen.queryByText(/awaiting approval/i)).not.toBeInTheDocument();
    });
  });

  describe("authenticated", () => {
    beforeEach(() => {
      mockUseSession.mockReturnValue({ status: "authenticated", data: { user: { id: "u1" } } });
    });

    it("renders nothing while the session is loading", () => {
      mockUseSession.mockReturnValue({ status: "loading", data: null });
      const { container } = render(<BlogCommentForm postSlug="a-post" />);
      expect(container).toBeEmptyDOMElement();
    });

    it("does not render Name/Email inputs and can submit with just a body", async () => {
      global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "pending-review" }) }) as unknown as typeof fetch;
      const user = userEvent.setup();
      render(<BlogCommentForm postSlug="a-post" />);

      expect(screen.queryByLabelText(/^name$/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^email$/i)).not.toBeInTheDocument();

      await user.type(screen.getByLabelText(/comment/i), "This is a lovely, sufficiently long comment.");
      await user.click(screen.getByRole("button", { name: /submit/i }));

      await waitFor(() => expect(screen.getByText(/awaiting approval/i)).toBeInTheDocument());
      const post = (global.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
      const sentBody = JSON.parse(String(post?.[1]?.body));
      expect(sentBody.name).toBeUndefined();
      expect(sentBody.email).toBeUndefined();
      expect(sentBody.body).toBe("This is a lovely, sufficiently long comment.");
    });
  });
});
