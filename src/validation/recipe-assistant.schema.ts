import { z } from "zod";

/** STORY-062. .max(500) mirrors question.schema.ts's precedent for a free-text chat-style input. */

export const sendRecipeAssistantMessageSchema = z.object({
  conversationId: z.string().cuid().nullable().optional(),
  message: z.string().trim().min(1, "Message is required.").max(500, "Keep your message under 500 characters."),
  filters: z
    .object({
      dietaryTagSlugs: z.array(z.string()).default([]),
      categorySlug: z.string().nullable().default(null),
    })
    .default({ dietaryTagSlugs: [], categorySlug: null }),
});

export type SendRecipeAssistantMessageInput = z.infer<typeof sendRecipeAssistantMessageSchema>;
