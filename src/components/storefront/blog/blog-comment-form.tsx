"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/api-error";
import { postComment } from "@/lib/api/blog-comment-client";
import { cn } from "@/lib/utils";
import { blogCommentInputSchema, blogGuestCommentInputSchema, type BlogCommentInput } from "@/validation/blog.schema";

/** Fields the server can return a `fieldErrors` entry for. */
const COMMENT_FIELDS = ["name", "email", "body"] as const;

export function BlogCommentForm({ postSlug }: { postSlug: string }) {
  const { status } = useSession();

  if (status === "loading") return null;

  return <CommentFormBody postSlug={postSlug} isAuthenticated={status === "authenticated"} />;
}

function CommentFormBody({ postSlug, isAuthenticated }: { postSlug: string; isAuthenticated: boolean }) {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<BlogCommentInput>({
    // A signed-in caller's identity comes from the session (submitComment
    // ignores any client-supplied name/email for it), so name/email stay
    // optional. A guest must actually supply both — the stricter schema
    // enforces that client-side, mirroring the guest-only re-validation
    // the route performs server-side.
    resolver: zodResolver(isAuthenticated ? blogCommentInputSchema : blogGuestCommentInputSchema),
    defaultValues: { honeypot: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    try {
      await postComment(postSlug, data);
      setSubmitted(true);
    } catch (error) {
      const fieldErrors = error instanceof ApiError ? error.fieldErrors : undefined;
      let handledAsFieldError = false;
      for (const field of COMMENT_FIELDS) {
        const message = fieldErrors?.[field]?.[0];
        if (message) {
          setError(field, { message });
          handledAsFieldError = true;
        }
      }
      if (!handledAsFieldError) {
        setError("root", {
          message: error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
        });
      }
    }
  });

  if (submitted) {
    return (
      <p role="status" className="rounded-lg border border-input p-4 text-body text-charcoal">
        Thanks — your comment is awaiting approval.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      {!isAuthenticated && (
        <>
          <div>
            <Label htmlFor="comment-name">Name</Label>
            <Input
              id="comment-name"
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "comment-name-error" : undefined}
              {...register("name")}
            />
            {errors.name && (
              <p id="comment-name-error" className="mt-1 text-small text-destructive">
                {errors.name.message}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="comment-email">Email</Label>
            <Input
              id="comment-email"
              type="email"
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "comment-email-error" : undefined}
              {...register("email")}
            />
            {errors.email && (
              <p id="comment-email-error" className="mt-1 text-small text-destructive">
                {errors.email.message}
              </p>
            )}
          </div>
        </>
      )}
      <div>
        <Label htmlFor="comment-body">Comment</Label>
        <textarea
          id="comment-body"
          rows={4}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? "comment-body-error" : undefined}
          className={cn(
            "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          )}
          {...register("body")}
        />
        {errors.body && (
          <p id="comment-body-error" className="mt-1 text-small text-destructive">
            {errors.body.message}
          </p>
        )}
      </div>
      {/* Honeypot: visually and programmatically hidden, but present in the DOM
          and tabbable-by-default markup so a naive bot's form-fill still
          populates it. Absolute-positioned off-screen rather than
          display:none, since some bots skip display:none fields. */}
      <input
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] size-px overflow-hidden"
        {...register("honeypot")}
      />
      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}
      <Button type="submit" disabled={isSubmitting}>
        Submit comment
      </Button>
    </form>
  );
}
