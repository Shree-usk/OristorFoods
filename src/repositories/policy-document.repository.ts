import { prisma } from "@/lib/db";

/** STORY-063. The only file querying PolicyDocument directly. */

export function listPolicyDocuments() {
  return prisma.policyDocument.findMany({ orderBy: { title: "asc" } });
}

export function findPolicyDocumentById(id: string) {
  return prisma.policyDocument.findUnique({ where: { id } });
}

export function findPolicyDocumentBySlug(slug: string) {
  return prisma.policyDocument.findUnique({ where: { slug } });
}

export interface PolicyDocumentInput {
  slug: string;
  title: string;
  content: string;
}

export function createPolicyDocument(input: PolicyDocumentInput, updatedById: string) {
  return prisma.policyDocument.create({ data: { ...input, updatedById } });
}

export function updatePolicyDocument(id: string, input: Partial<PolicyDocumentInput>, updatedById: string) {
  return prisma.policyDocument.update({ where: { id }, data: { ...input, updatedById } });
}

export function deletePolicyDocument(id: string) {
  return prisma.policyDocument.delete({ where: { id } });
}
