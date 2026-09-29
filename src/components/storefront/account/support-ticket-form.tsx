"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { SupportTicketInput } from "@/validation/support-ticket.schema";

const CATEGORY_OPTIONS: Array<{ value: SupportTicketInput["category"]; label: string }> = [
  { value: "OrderIssue", label: "Order issue" },
  { value: "Product", label: "Product" },
  { value: "Delivery", label: "Delivery" },
  { value: "Billing", label: "Billing" },
  { value: "Other", label: "Other" },
];

const TEXTAREA_CLASSNAME =
  "min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm dark:bg-input/30";

/**
 * STORY-036. Arrives pre-filled with the order number when launched from
 * an order's "Contact Support" link (`?order=` search param). Submitting
 * refreshes the page so the new ticket appears in TicketHistoryList
 * (a Server Component) without a second data-fetching layer here.
 */
export function SupportTicketForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("order") ?? undefined;

  const [category, setCategory] = useState<SupportTicketInput["category"]>(orderNumber ? "OrderIssue" : "Other");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "submitting" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setState("submitting");
    setErrorMessage(null);
    try {
      const response = await fetch("/api/account/support/tickets", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ category, subject, message, orderNumber }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Something went wrong. Please try again.");
      }
      setSubject("");
      setMessage("");
      router.refresh();
    } catch (error) {
      setState("error");
      setErrorMessage(error instanceof Error ? error.message : "Something went wrong. Please try again.");
      return;
    }
    setState("idle");
  }

  return (
    <form id="support-ticket-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
      {orderNumber && <p className="text-small text-charcoal/70">Regarding order {orderNumber}</p>}

      <div>
        <Label htmlFor="ticket-category">Category</Label>
        <Select value={category} onValueChange={(value) => setCategory(value as SupportTicketInput["category"])}>
          <SelectTrigger id="ticket-category" aria-label="Category">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="ticket-subject">Subject</Label>
        <Input id="ticket-subject" value={subject} onChange={(event) => setSubject(event.target.value)} required maxLength={200} />
      </div>

      <div>
        <Label htmlFor="ticket-message">Message</Label>
        <textarea
          id="ticket-message"
          className={TEXTAREA_CLASSNAME}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          required
          maxLength={4000}
        />
      </div>

      {state === "error" && errorMessage && <p className="text-small text-destructive">{errorMessage}</p>}

      <Button type="submit" disabled={state === "submitting"} className="self-start">
        {state === "submitting" ? "Sending…" : "Send message"}
      </Button>
    </form>
  );
}
