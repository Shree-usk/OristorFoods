"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Star } from "lucide-react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useState } from "react";
import { useController, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteReview, fetchMyReview, patchReview, postReview, ReviewApiError } from "@/lib/api/review-client";
import { cn } from "@/lib/utils";
import type { OwnReview, ReviewStatusValue } from "@/types/review";
import { reviewInputSchema, type ReviewInput } from "@/validation/review.schema";

const statusNotes: Record<Exclude<ReviewStatusValue, "Pending">, string> = {
  Approved: "Your review has been approved and will appear here soon.",
  Published: "Thanks! Your review has been published.",
  Rejected: "Your review wasn't approved for publication.",
  Archived: "Your review is no longer shown on this product.",
};

const reviewFields = ["rating", "title", "body"] as const;

export function ReviewForm({ productSlug }: { productSlug: string }) {
  const { status } = useSession();

  if (status === "loading") return null;
  if (status === "unauthenticated") {
    const callbackUrl = encodeURIComponent(`/products/${productSlug}`);
    return (
      <p className="text-small text-charcoal">
        <Link href={`/account/login?callbackUrl=${callbackUrl}`} className="font-medium underline underline-offset-4">
          Sign in to write a review
        </Link>
      </p>
    );
  }
  return <SignedInReviewPanel productSlug={productSlug} />;
}

function SignedInReviewPanel({ productSlug }: { productSlug: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["my-review", productSlug];
  const { data: myReview, isPending, isError } = useQuery({ queryKey, queryFn: () => fetchMyReview(productSlug) });
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingWithdraw, setIsConfirmingWithdraw] = useState(false);
  const withdraw = useMutation({
    mutationFn: (reviewId: string) => deleteReview(productSlug, reviewId),
    onSuccess: () => {
      queryClient.setQueryData(queryKey, null);
      setIsConfirmingWithdraw(false);
    },
  });

  if (isPending) return null;
  if (isError) {
    return (
      <p role="alert" className="text-small text-destructive">
        Couldn&apos;t load your review. Please refresh the page.
      </p>
    );
  }

  if (!myReview || isEditing) {
    return (
      <ReviewFormFields
        productSlug={productSlug}
        existing={isEditing ? myReview : null}
        onSaved={(review) => {
          queryClient.setQueryData(queryKey, review);
          setIsEditing(false);
        }}
        onConflict={() => {
          setIsEditing(false);
          void queryClient.invalidateQueries({ queryKey });
        }}
        onCancel={isEditing ? () => setIsEditing(false) : undefined}
      />
    );
  }

  if (myReview.status !== "Pending") {
    return (
      <p role="status" className="text-small text-charcoal">
        {statusNotes[myReview.status]}
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-charcoal/10 p-4">
      <p role="status" className="text-small font-medium text-charcoal">
        Thanks! Your review is pending approval.
      </p>
      {isConfirmingWithdraw ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <p className="text-small text-charcoal">Withdraw your review? This can&apos;t be undone.</p>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={withdraw.isPending}
            onClick={() => withdraw.mutate(myReview.id)}
          >
            Yes, withdraw
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsConfirmingWithdraw(false)}>
            Keep it
          </Button>
        </div>
      ) : (
        <div className="mt-3 flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            Edit review
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setIsConfirmingWithdraw(true)}>
            Withdraw
          </Button>
        </div>
      )}
      {withdraw.isError && (
        <p role="alert" className="mt-2 text-small text-destructive">
          Couldn&apos;t withdraw your review. Please try again.
        </p>
      )}
    </div>
  );
}

interface ReviewFormFieldsProps {
  productSlug: string;
  existing: OwnReview | null | undefined;
  onSaved: (review: OwnReview) => void;
  /** 409: the customer already has a review, or it's no longer Pending. */
  onConflict: () => void;
  onCancel?: () => void;
}

function ReviewFormFields({ productSlug, existing, onSaved, onConflict, onCancel }: ReviewFormFieldsProps) {
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ReviewInput>({
    resolver: zodResolver(reviewInputSchema),
    defaultValues: existing
      ? { rating: existing.rating, title: existing.title, body: existing.body }
      : { title: "", body: "" },
  });
  // Controlled, not register(): RHF compares a radio's string value ("4")
  // with the numeric default (4) strictly, so an edited review would open
  // with no star selected.
  const { field: ratingField } = useController({ name: "rating", control });
  const selectedRating: number = ratingField.value ?? 0;

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = existing ? await patchReview(productSlug, existing.id, values) : await postReview(productSlug, values);
      onSaved(saved);
    } catch (error) {
      if (error instanceof ReviewApiError && error.status === 409) {
        onConflict();
        return;
      }
      if (error instanceof ReviewApiError && error.status === 400) {
        let hasFieldError = false;
        for (const field of reviewFields) {
          const message = error.fieldErrors[field]?.[0];
          if (message) {
            setError(field, { message });
            hasFieldError = true;
          }
        }
        if (hasFieldError) return;
      }
      setError("root", {
        message: error instanceof ReviewApiError ? error.message : "Something went wrong. Please try again.",
      });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-xl flex-col gap-4">
      <h3 className="text-h4 font-heading text-charcoal">{existing ? "Edit your review" : "Write a review"}</h3>

      <fieldset aria-describedby={errors.rating ? "review-rating-error" : undefined}>
        <legend className="text-small font-medium text-charcoal">Your rating</legend>
        <div className="mt-1 flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <label key={star} className="cursor-pointer">
              <input
                type="radio"
                name={ratingField.name}
                value={star}
                checked={selectedRating === star}
                onChange={() => ratingField.onChange(star)}
                onBlur={ratingField.onBlur}
                className="peer sr-only"
              />
              <Star
                aria-hidden="true"
                className={cn(
                  "size-7 rounded-sm text-gold peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50",
                  selectedRating >= star ? "fill-current" : "fill-none text-charcoal/30",
                )}
              />
              <span className="sr-only">{star === 1 ? "1 star" : `${star} stars`}</span>
            </label>
          ))}
        </div>
        {errors.rating && (
          <p id="review-rating-error" className="mt-1 text-small text-destructive">
            {errors.rating.message}
          </p>
        )}
      </fieldset>

      <div className="flex flex-col gap-1">
        <Label htmlFor="review-title">Title</Label>
        <Input
          id="review-title"
          aria-invalid={errors.title ? true : undefined}
          aria-describedby={errors.title ? "review-title-error" : undefined}
          {...register("title")}
        />
        {errors.title && (
          <p id="review-title-error" className="text-small text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor="review-body">Your review</Label>
        <textarea
          id="review-body"
          rows={5}
          aria-invalid={errors.body ? true : undefined}
          aria-describedby={errors.body ? "review-body-error" : undefined}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          {...register("body")}
        />
        {errors.body && (
          <p id="review-body-error" className="text-small text-destructive">
            {errors.body.message}
          </p>
        )}
      </div>

      {errors.root && (
        <p role="alert" className="text-small text-destructive">
          {errors.root.message}
        </p>
      )}

      <div className="flex gap-2">
        <Button type="submit" disabled={isSubmitting}>
          {existing ? "Save changes" : "Submit review"}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  );
}
