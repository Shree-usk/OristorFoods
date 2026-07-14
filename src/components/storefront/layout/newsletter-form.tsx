"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newsletterSubscribeSchema, type NewsletterSubscribeInput } from "@/validation/newsletter.schema";

async function postSubscribe(input: NewsletterSubscribeInput) {
  const response = await fetch("/api/newsletter/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return response.json() as Promise<{ subscribed: true }>;
}

/**
 * The only Client Component boundary inside the footer — everything
 * else in footer.tsx is static/server-rendered per blueprint Section 3.
 */
export function NewsletterForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterSubscribeInput>({
    resolver: zodResolver(newsletterSubscribeSchema),
  });

  const mutation = useMutation({ mutationFn: postSubscribe });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data, { onSuccess: () => reset() });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="w-full max-w-sm">
      <Label htmlFor="footer-newsletter-email" className="text-ivory">
        Get recipes, offers &amp; new arrivals in your inbox
      </Label>
      <div className="mt-2 flex gap-2">
        <Input
          id="footer-newsletter-email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={errors.email ? "footer-newsletter-error" : undefined}
          {...register("email")}
        />
        <Button type="submit" disabled={isSubmitting}>
          Subscribe
        </Button>
      </div>

      {/*
        Meaning is conveyed by icon shape + message text + role, not by
        red/green hue: the brand's Chilli Red and Leaf Green don't meet
        WCAG contrast against this dark Charcoal footer surface (they're
        only verified against light backgrounds — see STORY-002's
        contrast table in docs/architecture-decisions.md), and relying on
        color alone to convey status fails WCAG 1.4.1 regardless.
      */}
      {errors.email && (
        <p id="footer-newsletter-error" role="alert" className="mt-2 flex items-center gap-1.5 text-small text-ivory">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {errors.email.message}
        </p>
      )}
      {mutation.isError && (
        <p role="alert" className="mt-2 flex items-center gap-1.5 text-small text-ivory">
          <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
          {mutation.error.message}
        </p>
      )}
      {mutation.isSuccess && (
        <p role="status" className="mt-2 flex items-center gap-1.5 text-small text-ivory">
          <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
          You&apos;re subscribed — welcome to Oristor!
        </p>
      )}
    </form>
  );
}
