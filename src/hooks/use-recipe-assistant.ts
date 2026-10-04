"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  fetchRecipeAssistantConversation,
  sendRecipeAssistantMessage,
  type RecipeAssistantFilters,
  type RecipeAssistantRecipeCard,
} from "@/lib/api/recipe-assistant-client";

const STORAGE_KEY = "recipe-assistant-conversation-id";

export interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  recipes?: RecipeAssistantRecipeCard[];
  clarifyingQuestion?: string | null;
}

/**
 * STORY-062. conversationId lives in sessionStorage — "persists
 * within the session" (AC #6) without surviving a full browser
 * restart. The server only ever returns the latest turn per call;
 * this hook keeps the full visible transcript client-side,
 * restoring it from GET /conversations/[id] on mount if a
 * conversation id is already stored (e.g. the widget was closed and
 * reopened, or the trigger is on a different page).
 */
export function useRecipeAssistant() {
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [restored, setRestored] = useState(false);

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
        const rows = await fetchRecipeAssistantConversation(stored);
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

  const mutation = useMutation({
    mutationFn: (args: { message: string; filters: RecipeAssistantFilters }) => sendRecipeAssistantMessage(conversationId, args.message, args.filters),
    onSuccess: (result) => {
      setConversationId(result.conversationId);
      sessionStorage.setItem(STORAGE_KEY, result.conversationId);
      setMessages((prev) => [
        ...prev,
        { id: `assistant-${result.conversationId}-${prev.length}`, role: "assistant", content: result.message, recipes: result.recipes, clarifyingQuestion: result.clarifyingQuestion },
      ]);
    },
  });

  function sendMessage(message: string, filters: RecipeAssistantFilters) {
    setMessages((prev) => [...prev, { id: `user-${prev.length}-${Date.now()}`, role: "user", content: message }]);
    mutation.mutate({ message, filters });
  }

  return { messages, sendMessage, isSending: mutation.isPending, restored, error: mutation.error instanceof Error ? mutation.error.message : null };
}
