import { prisma } from "@/lib/db";

/** STORY-051b. The only place Redirect is queried/mutated. */

export function listRedirectsForAdmin() {
  return prisma.redirect.findMany({ orderBy: { createdAt: "desc" } });
}

export function findRedirectById(id: string) {
  return prisma.redirect.findUnique({ where: { id } });
}

/** The proxy cache's own read — only active rows matter for resolution. */
export function listActiveRedirects() {
  return prisma.redirect.findMany({ where: { active: true }, select: { sourcePath: true, destinationPath: true, statusCode: true } });
}

export interface RedirectInput {
  sourcePath: string;
  destinationPath: string;
  statusCode: number;
  active: boolean;
}

export function createRedirect(input: RedirectInput, createdById: string) {
  return prisma.redirect.create({ data: { ...input, createdById } });
}

export function updateRedirect(id: string, input: Partial<RedirectInput>) {
  return prisma.redirect.update({ where: { id }, data: input });
}

export function deleteRedirect(id: string) {
  return prisma.redirect.delete({ where: { id } });
}
