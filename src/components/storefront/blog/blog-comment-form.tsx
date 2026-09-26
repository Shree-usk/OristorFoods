"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { blogCommentInputSchema, type BlogCommentInput } from "@/validation/blog.schema";
import { cn } from "@/lib/utils";

/**
 * The honeypot field must never surface a client-side validation error.
 * `blogCommentInputSchema`'s `honeypot: z.string().max(0)` rule exists so
 * the *server* can silently no-op a spam submission while returning the
 * exact same `{ status: "pending-review" }` shape as a genuine one — a bot
 * (or a browser extension that blindly autofills every field, hidden ones
 * included) must not be able to tell the two paths apart. If the form used
 * `blogCommentInputSchema` directly as its resolver, a non-empty honeypot
 * would fail client-side validation, `handleSubmit`'s success callback
 * would never run, and the form would just silently stop responding —
 * never calling the API and never showing the "awaiting approval" message
 * a real submission shows. That's a *visible* difference (nothing happens
 * vs. a clear confirmation), which defeats the whole point, and it would
 * also strand a genuine human whose browser happens to autofill the hidden
 * field. So this schema keeps every other rule (name/email/body) but
 * relaxes `honeypot` to a plain string: whatever ends up in it is still
 * submitted to the server untouched, and the server remains the only place
 * that decides what to do with it.
 */
const commentFormSchema = blogCommentInputSchema.extend({ honeypot: z.string() });

export function BlogCommentForm({ postSlug }: { postSlug: string }) {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlogCommentInput>({
    resolver: zodResolver(commentFormSchema),
    defaultValues: { honeypot: "" },
  });

  const onSubmit = handleSubmit(async (data) => {
    await fetch(`/api/blog/${postSlug}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    setSubmitted(true);
  });

  if (submitted) {
    return <p className="rounded-lg border border-input p-4 text-body text-charcoal">Thanks — your comment is awaiting approval.</p>;
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div>
        <Label htmlFor="comment-name">Name</Label>
        <Input id="comment-name" aria-describedby={errors.name ? "comment-name-error" : undefined} {...register("name")} />
        {errors.name && (
          <p id="comment-name-error" className="mt-1 text-small text-red-600">
            {errors.name.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="comment-email">Email</Label>
        <Input id="comment-email" type="email" aria-describedby={errors.email ? "comment-email-error" : undefined} {...register("email")} />
        {errors.email && (
          <p id="comment-email-error" className="mt-1 text-small text-red-600">
            {errors.email.message}
          </p>
        )}
      </div>
      <div>
        <Label htmlFor="comment-body">Comment</Label>
        <textarea
          id="comment-body"
          rows={4}
          aria-describedby={errors.body ? "comment-body-error" : undefined}
          className={cn(
            "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
          )}
          {...register("body")}
        />
        {errors.body && (
          <p id="comment-body-error" className="mt-1 text-small text-red-600">
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
      <Button type="submit" disabled={isSubmitting}>
        Submit comment
      </Button>
    </form>
  );
}
