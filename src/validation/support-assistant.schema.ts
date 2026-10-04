import { z } from "zod";

/** STORY-063. .max(500) mirrors recipe-assistant.schema.ts's precedent for a free-text chat-style input. */

export const sendSupportAssistantMessageSchema = z.object({
  conversationId: z.string().cuid().nullable().optional(),
  message: z.string().trim().min(1, "Message is required.").max(500, "Keep your message under 500 characters."),
});

export type SendSupportAssistantMessageInput = z.infer<typeof sendSupportAssistantMessageSchema>;

export const escalateSupportAssistantSchema = z.object({
  conversationId: z.string().cuid(),
});
