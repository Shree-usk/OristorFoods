import type { Prisma, RecipeAssistantMessageRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-062. The only file touching RecipeAssistantConversation/RecipeAssistantMessage directly. */

export function createConversation(customerId: string | null, sessionId: string | null) {
  return prisma.recipeAssistantConversation.create({ data: { customerId, sessionId } });
}

export function findConversationById(id: string) {
  return prisma.recipeAssistantConversation.findUnique({ where: { id } });
}

export function findRecentMessages(conversationId: string, limit: number) {
  return prisma.recipeAssistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function findConversationMessages(conversationId: string) {
  return prisma.recipeAssistantMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
}

export interface CreateMessageInput {
  conversationId: string;
  role: RecipeAssistantMessageRole;
  content: string;
  structuredPayload?: Prisma.InputJsonValue;
  promptTokens?: number;
  completionTokens?: number;
}

export function createMessage(input: CreateMessageInput) {
  return prisma.recipeAssistantMessage.create({ data: input });
}

export function touchConversation(id: string) {
  return prisma.recipeAssistantConversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
}
