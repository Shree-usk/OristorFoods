"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newsletterSignupSchema, type NewsletterSignupInput } from "@/validation/example.schema";

/**
 * Scratch component proving the React Hook Form + Zod + Shadcn UI pattern
 * end-to-end. Feature teams copy this shape: `zodResolver(schema)` wired
 * into `useForm`, the same schema reused server-side for the API route.
 */
export function NewsletterSignupForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewsletterSignupInput>({
    resolver: zodResolver(newsletterSignupSchema),
  });

  const onSubmit = handleSubmit((data) => {
    console.log("newsletter signup", data);
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      <Label htmlFor="newsletter-email">Email</Label>
      <Input id="newsletter-email" type="email" {...register("email")} />
      {errors.email && <p className="text-sm text-red-600">{errors.email.message}</p>}
      <Button type="submit" disabled={isSubmitting}>
        Subscribe
      </Button>
    </form>
  );
}
