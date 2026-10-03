import type { ExportEnquiryStatus, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-058. The only place ExportEnquiry/ExportEnquiryNote are queried/mutated. */

export interface CreateExportEnquiryInput {
  companyName: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  country: string;
  productsOfInterest: string;
  volumeEstimate?: string | null;
  message: string;
}

export function create(input: CreateExportEnquiryInput) {
  return prisma.exportEnquiry.create({ data: input });
}

export interface ExportEnquiryFilters {
  status?: ExportEnquiryStatus;
  country?: string;
  companyName?: string;
  productsOfInterest?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

function whereFromFilters(filters: ExportEnquiryFilters): Prisma.ExportEnquiryWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.country ? { country: { contains: filters.country, mode: "insensitive" } } : {}),
    ...(filters.companyName ? { companyName: { contains: filters.companyName, mode: "insensitive" } } : {}),
    ...(filters.productsOfInterest ? { productsOfInterest: { contains: filters.productsOfInterest, mode: "insensitive" } } : {}),
    ...(filters.dateFrom || filters.dateTo
      ? { createdAt: { ...(filters.dateFrom ? { gte: filters.dateFrom } : {}), ...(filters.dateTo ? { lte: filters.dateTo } : {}) } }
      : {}),
  };
}

const PAGE_SIZE = 25;

export async function listForAdmin(filters: ExportEnquiryFilters, page: number) {
  const where = whereFromFilters(filters);
  const [rows, total] = await Promise.all([
    prisma.exportEnquiry.findMany({
      where,
      include: { assignedTo: { select: { id: true, name: true, email: true } }, distributorAccount: { select: { id: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.exportEnquiry.count({ where }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE };
}

export function findById(id: string) {
  return prisma.exportEnquiry.findUnique({
    where: { id },
    include: {
      assignedTo: { select: { id: true, name: true, email: true } },
      distributorAccount: { select: { id: true } },
      notes: { include: { author: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
}

export function updateStatus(id: string, status: ExportEnquiryStatus) {
  return prisma.exportEnquiry.update({ where: { id }, data: { status } });
}

export function assign(id: string, assignedToId: string | null) {
  return prisma.exportEnquiry.update({ where: { id }, data: { assignedToId } });
}

export function addNote(enquiryId: string, authorId: string, body: string) {
  return prisma.exportEnquiryNote.create({ data: { enquiryId, authorId, body } });
}

export interface StatusCounts {
  status: ExportEnquiryStatus;
  count: number;
}

export async function countsByStatus(): Promise<StatusCounts[]> {
  const grouped = await prisma.exportEnquiry.groupBy({ by: ["status"], _count: { _all: true } });
  return grouped.map((row) => ({ status: row.status, count: row._count._all }));
}

export function countWonSince(since: Date) {
  return prisma.exportEnquiry.count({ where: { status: "Won", updatedAt: { gte: since } } });
}

export function countLostSince(since: Date) {
  return prisma.exportEnquiry.count({ where: { status: "Lost", updatedAt: { gte: since } } });
}
