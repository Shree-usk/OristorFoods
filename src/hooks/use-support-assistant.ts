"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";

import {
  escalateSupportAssistant,
  fetchSupportAssistantConversation,
  sendSupportAssistantMessage,
  type SupportAssistantOrderRef,
} from "@/lib/api/support-assistant-client";

const STORAGE_KEY = "support-assistant-conversation-id";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  referencedOrders?: SupportAssistantOrderRef[];
  requiresSignIn?: boolean;
  escalated?: boolean;
  ticketId?: string | null;
}

/**
 * STORY-063. conversationId lives in sessionStorage, same pattern as
 * use-recipe-assistant.ts. A guest conversation is never "upgraded"
 * in place: when useSession() transitions from signed-out to
 * signed-in, the stored conversation id is cleared so the next
 * message starts a fresh, customer-bound conversation — enforcing
 * the no-upgrade-in-place rule from the client side too (the service
 * layer's strict ownership check is the real boundary; this just
 * avoids the dead end of trying to continue an id the server will
 * reject).
 */
export function useSupportAssistant() {
  const { status } = useSession();
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [restored, setRestored] = useState(false);
  const previousStatus = useRef(status);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (!stored) {
        if (!cancelled) setRestored(true);
        return;
      }
      if (!cancelled) setConversationId(stored);
      try {
        const rows = await fetchSupportAssistantConversation(stored);
        if (!cancelled) setMessages(rows.map((row) => ({ id: row.id, role: row.role === "User" ? "user" : "assistant", content: row.content })));
      } catch {
        // Keep an empty transcript — the conversation id is still usable for the next send.
      } finally {
        if (!cancelled) setRestored(true);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (previousStatus.current === "unauthenticated" && status === "authenticated") {
      sessionStorage.removeItem(STORAGE_KEY);
      setConversationId(null);
      setMessages([]);
    }
    previousStatus.current = status;
  }, [status]);

  const mutation = useMutation({
    mutationFn: (message: string) => sendSupportAssistantMessage(conversationId, message),
    onSuccess: (result) => {
      setConversationId(result.conversationId);
      sessionStorage.setItem(STORAGE_KEY, result.conversationId);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${result.conversationId}-${prev.length}`,
          role: "assistant",
          content: result.message,
          referencedOrders: result.referencedOrders,
          requiresSignIn: result.requiresSignIn,
          escalated: result.escalated,
          ticketId: result.ticketId,
        },
      ]);
    },
  });

  const escalateMutation = useMutation({
    mutationFn: () => {
      if (!conversationId) throw new Error("Start a conversation first.");
      return escalateSupportAssistant(conversationId);
    },
    onSuccess: (result) => {
      setMessages((prev) => [...prev, { id: `assistant-escalate-${prev.length}`, role: "assistant", content: result.message, ticketId: result.ticketId }]);
    },
  });

  function sendMessage(message: string) {
    setMessages((prev) => [...prev, { id: `user-${prev.length}-${Date.now()}`, role: "user", content: message }]);
    mutation.mutate(message);
  }

  return {
    messages,
    sendMessage,
    isSending: mutation.isPending,
    escalate: () => escalateMutation.mutate(),
    isEscalating: escalateMutation.isPending,
    restored,
    error: mutation.error instanceof Error ? mutation.error.message : escalateMutation.error instanceof Error ? escalateMutation.error.message : null,
  };
}
