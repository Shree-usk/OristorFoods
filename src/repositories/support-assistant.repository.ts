import type { Prisma, SupportAssistantMessageRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-063. The only file touching SupportAssistantConversation/SupportAssistantMessage directly. */

export function createConversation(customerId: string | null, sessionId: string | null) {
  return prisma.supportAssistantConversation.create({ data: { customerId, sessionId } });
}

export function findConversationById(id: string) {
  return prisma.supportAssistantConversation.findUnique({ where: { id } });
}

export function findRecentMessages(conversationId: string, limit: number) {
  return prisma.supportAssistantMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function findConversationMessages(conversationId: string) {
  return prisma.supportAssistantMessage.findMany({ where: { conversationId }, orderBy: { createdAt: "asc" } });
}

export interface CreateMessageInput {
  conversationId: string;
  role: SupportAssistantMessageRole;
  content: string;
  structuredPayload?: Prisma.InputJsonValue;
  confidenceScore?: number;
  promptTokens?: number;
  completionTokens?: number;
}

export function createMessage(input: CreateMessageInput) {
  return prisma.supportAssistantMessage.create({ data: input });
}

export function touchConversation(id: string) {
  return prisma.supportAssistantConversation.update({ where: { id }, data: { lastMessageAt: new Date() } });
}

export function markEscalated(id: string) {
  return prisma.supportAssistantConversation.update({ where: { id }, data: { escalated: true, lastMessageAt: new Date() } });
}
