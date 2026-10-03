"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitExportEnquirySchema, type SubmitExportEnquiryInput } from "@/validation/export-enquiry.schema";

async function postEnquiry(input: SubmitExportEnquiryInput) {
  const response = await fetch("/api/export/enquiries", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const message = body && typeof body === "object" && "error" in body && typeof body.error === "string" ? body.error : "Something went wrong. Please try again.";
    throw new Error(message);
  }
  return response.json() as Promise<{ submitted: true }>;
}

/** STORY-058. Same RHF + Zod + useMutation shape as newsletter-form.tsx. */
export function ExportEnquiryForm() {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubmitExportEnquiryInput>({
    resolver: zodResolver(submitExportEnquirySchema),
  });

  const mutation = useMutation({ mutationFn: postEnquiry });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data, { onSuccess: () => reset() });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div>
        <Label htmlFor="export-company">Company name</Label>
        <Input id="export-company" autoComplete="organization" aria-invalid={errors.companyName ? true : undefined} {...register("companyName")} />
        {errors.companyName && <p className="mt-1 text-small text-destructive">{errors.companyName.message}</p>}
      </div>
      <div>
        <Label htmlFor="export-contact-name">Contact name</Label>
        <Input id="export-contact-name" autoComplete="name" aria-invalid={errors.contactName ? true : undefined} {...register("contactName")} />
        {errors.contactName && <p className="mt-1 text-small text-destructive">{errors.contactName.message}</p>}
      </div>
      <div>
        <Label htmlFor="export-email">Email</Label>
        <Input id="export-email" type="email" autoComplete="email" aria-invalid={errors.contactEmail ? true : undefined} {...register("contactEmail")} />
        {errors.contactEmail && <p className="mt-1 text-small text-destructive">{errors.contactEmail.message}</p>}
      </div>
      <div>
        <Label htmlFor="export-phone">Phone (optional)</Label>
        <Input id="export-phone" type="tel" autoComplete="tel" {...register("contactPhone")} />
      </div>
      <div>
        <Label htmlFor="export-country">Country</Label>
        <Input id="export-country" autoComplete="country-name" aria-invalid={errors.country ? true : undefined} {...register("country")} />
        {errors.country && <p className="mt-1 text-small text-destructive">{errors.country.message}</p>}
      </div>
      <div>
        <Label htmlFor="export-volume">Estimated volume (optional)</Label>
        <Input id="export-volume" placeholder="e.g. 500kg / month" {...register("volumeEstimate")} />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="export-products">Products of interest</Label>
        <Input id="export-products" placeholder="e.g. Kithul jaggery, spice blends" aria-invalid={errors.productsOfInterest ? true : undefined} {...register("productsOfInterest")} />
        {errors.productsOfInterest && <p className="mt-1 text-small text-destructive">{errors.productsOfInterest.message}</p>}
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="export-message">Tell us about your business</Label>
        <Textarea id="export-message" rows={5} aria-invalid={errors.message ? true : undefined} {...register("message")} />
        {errors.message && <p className="mt-1 text-small text-destructive">{errors.message.message}</p>}
      </div>

      <div className="sm:col-span-2">
        <Button type="submit" disabled={isSubmitting}>
          Send enquiry
        </Button>

        {mutation.isError && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-small text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {mutation.error.message}
          </p>
        )}
        {mutation.isSuccess && (
          <p role="status" className="mt-2 flex items-center gap-1.5 text-small text-leaf-dark">
            <CircleCheck className="size-4 shrink-0" aria-hidden="true" />
            Thank you — our export team will be in touch shortly.
          </p>
        )}
      </div>
    </form>
  );
}
