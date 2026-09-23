"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/api-error";
import { postQuestion } from "@/lib/api/question-client";
import { questionInputSchema, type QuestionInput } from "@/validation/question.schema";

const MAX_LENGTH = 500;

export function AskQuestionForm({ productSlug }: { productSlug: string }) {
  const { status } = useSession();

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    const callbackUrl = encodeURIComponent(`/products/${productSlug}`);
    return (
      <p className="text-small text-charcoal">
        <Link href={`/account/login?callbackUrl=${callbackUrl}`} className="font-medium underline underline-offset-4">
          Sign in to ask a question
        </Link>
      </p>
    );
  }
  return <SignedInAskForm productSlug={productSlug} />;
}

function SignedInAskForm({ productSlug }: { productSlug: string }) {
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);
  const {
    control,
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<QuestionInput>({ resolver: zodResolver(questionInputSchema), defaultValues: { text: "" } });
  const text = useWatch({ control, name: "text" });

  const onSubmit = handleSubmit(async (values) => {
    setSubmitted(false);
    try {
      await postQuestion(productSlug, values);
      reset({ text: "" });
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ["my-questions", productSlug] });
    } catch (error) {
      const fieldMessage = error instanceof ApiError ? error.fieldErrors.text?.[0] : undefined;
      if (fieldMessage) {
        setError("text", { message: fieldMessage });
        return;
      }
      setError("root", {
        message: error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      });
    }
  });

  const describedBy = ["question-text-count", errors.text ? "question-text-error" : ""].filter(Boolean).join(" ");

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-2">
      <h3 className="text-h4 font-heading text-charcoal">Ask a question</h3>
      <Label htmlFor="question-text">Your question</Label>
      <textarea
        id="question-text"
        rows={3}
        maxLength={MAX_LENGTH}
        aria-invalid={errors.text ? true : undefined}
        aria-describedby={describedBy}
        className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        {...register("text")}
      />
      <p id="question-text-count" className="text-caption text-charcoal/70">
        {text.length}/{MAX_LENGTH}
      </p>
      {errors.text && (
        <p id="question-text-error" className="text-small text-destructive">
          {errors.text.message}
        </p>
      )}
      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}
      {submitted && (
        <p role="status" className="text-small font-medium text-charcoal">
          Thanks! Your question was submitted and is pending review.
        </p>
      )}
      <div>
        <Button type="submit" disabled={isSubmitting}>
          Submit question
        </Button>
      </div>
    </form>
  );
}
