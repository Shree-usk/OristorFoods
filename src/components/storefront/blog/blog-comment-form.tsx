"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { blogCommentInputSchema, type BlogCommentInput } from "@/validation/blog.schema";
import { cn } from "@/lib/utils";

export function BlogCommentForm({ postSlug }: { postSlug: string }) {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<BlogCommentInput>({
    resolver: zodResolver(blogCommentInputSchema),
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
