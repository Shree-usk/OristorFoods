"use client";

import { useState } from "react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSupportAssistant } from "@/hooks/use-support-assistant";

interface SupportAssistantWidgetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * STORY-063. No raw token streaming — see docs/architecture-decisions.md.
 * A "thinking" indicator shows while a request is in flight; the
 * complete, server-guardrail-validated message renders once it
 * returns. Persistent "AI assistant" + "Talk to a human" controls in
 * the header, always visible, per AC #8.
 */
export function SupportAssistantWidget({ open, onOpenChange }: SupportAssistantWidgetProps) {
  const { messages, sendMessage, isSending, escalate, isEscalating, restored, error } = useSupportAssistant();
  const [input, setInput] = useState("");

  function handleSend(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;
    sendMessage(trimmed);
    setInput("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-label="Customer Support Assistant" className="flex max-h-[85vh] flex-col sm:max-w-lg">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-h4 font-heading text-charcoal">Support Assistant</h2>
          <Button type="button" variant="outline" size="sm" disabled={isEscalating} onClick={() => escalate()}>
            Talk to a human
          </Button>
        </div>
        <p className="text-small text-charcoal/70">Ask about an order, a product, or our returns &amp; refund policy.</p>
        <p className="text-caption text-charcoal/60">
          This is an AI assistant — it can make mistakes. Conversations are saved to help us improve support and may be reviewed by our team.
        </p>

        <div aria-live="polite" className="flex-1 overflow-y-auto rounded-lg bg-cream/50 p-3" style={{ minHeight: "16rem" }}>
          {!restored && <p className="text-small text-charcoal/70">Loading…</p>}
          {restored && messages.length === 0 && <p className="text-small text-charcoal/70">Ask me anything about your orders, our products, or our policies.</p>}
          <ul className="flex flex-col gap-3">
            {messages.map((item) => (
              <li
                key={item.id}
                className={
                  item.role === "user"
                    ? "ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-small text-primary-foreground"
                    : "mr-auto max-w-[90%] rounded-lg bg-background px-3 py-2 text-small text-charcoal"
                }
              >
                <p>{item.content}</p>
                {item.referencedOrders && item.referencedOrders.length > 0 && (
                  <ul className="mt-1 text-caption text-charcoal/70">
                    {item.referencedOrders.map((order) => (
                      <li key={order.orderNumber}>
                        {order.orderNumber} — {order.status}
                      </li>
                    ))}
                  </ul>
                )}
                {item.requiresSignIn && (
                  <Button type="button" size="sm" className="mt-2" nativeButton={false} render={<Link href="/account/login" />}>
                    Sign in
                  </Button>
                )}
                {item.escalated && item.ticketId && (
                  <Button type="button" size="sm" variant="outline" className="mt-2" nativeButton={false} render={<Link href="/account/support" />}>
                    View your ticket
                  </Button>
                )}
              </li>
            ))}
            {(isSending || isEscalating) && <li className="mr-auto max-w-[90%] rounded-lg bg-background px-3 py-2 text-small text-charcoal/70">Thinking…</li>}
          </ul>
        </div>

        {error && <p className="text-small text-destructive">{error}</p>}

        <form onSubmit={handleSend} className="flex gap-2">
          <Input
            aria-label="Message the Support Assistant"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="e.g. What's the status of my last order?"
            disabled={isSending}
          />
          <Button type="submit" disabled={isSending || !input.trim()}>
            Send
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
