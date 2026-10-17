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
  /** Export & Wholesale catalogue's structured product selection — empty/omitted for the plain enquiry form. */
  productIds?: string[];
}

export function create(input: CreateExportEnquiryInput) {
  const { productIds, ...rest } = input;
  return prisma.exportEnquiry.create({
    data: { ...rest, products: productIds?.length ? { connect: productIds.map((id) => ({ id })) } : undefined },
  });
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
      include: {
        assignedTo: { select: { id: true, name: true, email: true } },
        distributorAccount: { select: { id: true } },
        products: { select: { id: true, name: true, sku: true } },
      },
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
      products: { select: { id: true, name: true, sku: true, slug: true, images: { where: { isPrimary: true }, take: 1 } } },
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

const MAX_EXPORT_ROWS = 10_000;

/** CSV export (admin-export.service.ts::exportEnquiriesCsv) — same filters as listForAdmin, no pagination, capped like audit-log.repository.ts's own listForExport. */
export function listForExport(filters: ExportEnquiryFilters) {
  return prisma.exportEnquiry.findMany({
    where: whereFromFilters(filters),
    include: {
      assignedTo: { select: { name: true } },
      products: { select: { name: true, sku: true } },
    },
    orderBy: { createdAt: "desc" },
    take: MAX_EXPORT_ROWS,
  });
}

export function countWonSince(since: Date) {
  return prisma.exportEnquiry.count({ where: { status: "Won", updatedAt: { gte: since } } });
}

export function countLostSince(since: Date) {
  return prisma.exportEnquiry.count({ where: { status: "Lost", updatedAt: { gte: since } } });
}
