import { prisma } from "@/lib/db";

/** STORY-048. The only place AdminNote is queried/mutated. Append-only — no update/delete. */

export function createAdminNote(customerId: string, authorId: string, body: string) {
  return prisma.adminNote.create({ data: { customerId, authorId, body } });
}

export function findAdminNotesByCustomerId(customerId: string) {
  return prisma.adminNote.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
  });
}
