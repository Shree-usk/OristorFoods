"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { CircleAlert, CircleCheck } from "lucide-react";
import { Controller, useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { submitContactEnquiry } from "@/lib/api/contact-enquiry-client";
import { submitContactEnquirySchema, type SubmitContactEnquiryInput } from "@/validation/contact-enquiry.schema";

const ENQUIRY_TYPE_OPTIONS = [
  { value: "General", label: "General Enquiry" },
  { value: "Product", label: "Product Enquiry" },
  { value: "CustomerSupport", label: "Customer Support" },
  { value: "Wholesale", label: "Wholesale" },
  { value: "Distributor", label: "Distributor / Dealer" },
  { value: "Export", label: "Export / International Business" },
  { value: "RetailPartnership", label: "Retail Partnership" },
  { value: "FoodService", label: "Food Service / Hospitality" },
  { value: "Media", label: "Media / Marketing" },
  { value: "Careers", label: "Careers" },
  { value: "Other", label: "Other" },
] as const;

const BUSINESS_TYPE_OPTIONS = ["Importer", "Distributor", "Supermarket", "Retailer", "Food Service", "Restaurant / Hotel", "Wholesaler", "Other"];

/** STORY-072. Export/International Business and Wholesale/Distributor each reveal their own extra fields — the AC's "dynamically display" instruction, enforced here, not in the Zod schema (which keeps every business field optional). */
function showsBusinessFields(enquiryType: string): boolean {
  return enquiryType === "Export" || enquiryType === "Wholesale" || enquiryType === "Distributor";
}

/** STORY-072. Single-column, large fields throughout — the brief's own instruction to avoid a cramped desktop-style two-column form on mobile. */
export function ContactEnquiryForm() {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<SubmitContactEnquiryInput>({
    resolver: zodResolver(submitContactEnquirySchema),
    defaultValues: { enquiryType: "General", honeypot: "" },
  });

  const enquiryType = watch("enquiryType");
  const mutation = useMutation({ mutationFn: submitContactEnquiry });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(data, { onSuccess: () => reset({ enquiryType: "General", honeypot: "" }) });
  });

  if (mutation.isSuccess) {
    return (
      <div role="status" aria-live="polite" className="rounded-lg border border-border bg-cream p-8 text-center">
        <CircleCheck className="mx-auto size-10 text-leaf-dark" aria-hidden="true" />
        <h2 className="mt-4 text-h4 font-heading text-charcoal">Thank you for reaching out.</h2>
        <p className="mt-2 text-body text-charcoal/80">Your enquiry has been received. Our team will get back to you shortly.</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          <Link href="/" className="text-small font-medium text-chilli hover:underline">
            Back to ORISTOR
          </Link>
          <Link href="/products" className="text-small font-medium text-chilli hover:underline">
            Explore our products →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid grid-cols-1 gap-6" aria-live="polite">
      <div>
        <Label htmlFor="contact-name">Hi, I&apos;m</Label>
        <Input id="contact-name" autoComplete="name" aria-invalid={errors.contactName ? true : undefined} {...register("contactName")} />
        {errors.contactName && <p className="mt-1 text-small text-destructive">{errors.contactName.message}</p>}
      </div>

      <div>
        <Label htmlFor="contact-enquiry-type">I&apos;m contacting ORISTOR about</Label>
        <Controller
          control={control}
          name="enquiryType"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="contact-enquiry-type" className="w-full">
                <SelectValue>{(selected: string | null) => ENQUIRY_TYPE_OPTIONS.find((option) => option.value === selected)?.label ?? "General Enquiry"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ENQUIRY_TYPE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div>
        <Label htmlFor="contact-email">My email is</Label>
        <Input id="contact-email" type="email" autoComplete="email" aria-invalid={errors.contactEmail ? true : undefined} {...register("contactEmail")} />
        {errors.contactEmail && <p className="mt-1 text-small text-destructive">{errors.contactEmail.message}</p>}
      </div>

      <div>
        <Label htmlFor="contact-phone">My phone number is (optional)</Label>
        <Input id="contact-phone" type="tel" autoComplete="tel" aria-invalid={errors.contactPhone ? true : undefined} {...register("contactPhone")} />
        {errors.contactPhone && <p className="mt-1 text-small text-destructive">{errors.contactPhone.message}</p>}
      </div>

      {showsBusinessFields(enquiryType) && (
        <>
          <div>
            <Label htmlFor="contact-company">Company name</Label>
            <Input id="contact-company" autoComplete="organization" {...register("companyName")} />
          </div>
          <div>
            <Label htmlFor="contact-country">Country</Label>
            <Input id="contact-country" autoComplete="country-name" {...register("country")} />
          </div>
          <div>
            <Label htmlFor="contact-business-type">Business type</Label>
            <Controller
              control={control}
              name="businessType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="contact-business-type" className="w-full">
                    <SelectValue>{(selected: string | null) => selected ?? "Select a business type"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {BUSINESS_TYPE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="contact-product-interest">Products {enquiryType === "Export" ? "of interest" : "you're interested in"}</Label>
            <Input id="contact-product-interest" {...register("productInterest")} />
          </div>
          <div>
            <Label htmlFor="contact-estimated-requirement">{enquiryType === "Export" ? "Estimated requirement" : "Expected order volume"} (optional)</Label>
            <Input id="contact-estimated-requirement" placeholder="e.g. 500kg / month" {...register("estimatedRequirement")} />
          </div>
        </>
      )}

      <div>
        <Label htmlFor="contact-message">Tell us a little more</Label>
        <Textarea id="contact-message" rows={5} aria-invalid={errors.message ? true : undefined} {...register("message")} />
        {errors.message && <p className="mt-1 text-small text-destructive">{errors.message.message}</p>}
      </div>

      {/* Honeypot: visually and programmatically hidden, but present in the DOM
          and tabbable-by-default markup so a naive bot's form-fill still
          populates it. Mirrors blog-comment-form.tsx's exact pattern. */}
      <input
        type="text"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        className="absolute -left-[9999px] size-px overflow-hidden"
        {...register("honeypot")}
      />

      <div>
        <Button type="submit" size="lg" disabled={isSubmitting} className="w-full sm:w-auto">
          {isSubmitting ? "Sending…" : "Send enquiry →"}
        </Button>
        {mutation.isError && (
          <p role="alert" className="mt-2 flex items-center gap-1.5 text-small text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {mutation.error.message}
          </p>
        )}
      </div>
    </form>
  );
}
