import type { ContactEnquiryStatus, ContactEnquiryType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** STORY-072. The only place ContactEnquiry is queried/mutated. Covers every enquiry type except Export, which routes into export-enquiry.repository.ts instead. */

export interface CreateContactEnquiryInput {
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  companyName?: string | null;
  country?: string | null;
  enquiryType: ContactEnquiryType;
  businessType?: string | null;
  productInterest?: string | null;
  message: string;
}

export function create(input: CreateContactEnquiryInput) {
  return prisma.contactEnquiry.create({ data: input });
}

export interface ContactEnquiryFilters {
  status?: ContactEnquiryStatus;
  enquiryType?: ContactEnquiryType;
  search?: string;
}

function whereFromFilters(filters: ContactEnquiryFilters): Prisma.ContactEnquiryWhereInput {
  return {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.enquiryType ? { enquiryType: filters.enquiryType } : {}),
    ...(filters.search
      ? {
          OR: [
            { contactName: { contains: filters.search, mode: "insensitive" } },
            { contactEmail: { contains: filters.search, mode: "insensitive" } },
            { companyName: { contains: filters.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

const PAGE_SIZE = 25;

export async function listForAdmin(filters: ContactEnquiryFilters, page: number) {
  const where = whereFromFilters(filters);
  const [rows, total] = await Promise.all([
    prisma.contactEnquiry.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.contactEnquiry.count({ where }),
  ]);
  return { rows, total, page, pageSize: PAGE_SIZE };
}

export function findById(id: string) {
  return prisma.contactEnquiry.findUnique({ where: { id } });
}

export function updateStatus(id: string, status: ContactEnquiryStatus) {
  return prisma.contactEnquiry.update({ where: { id }, data: { status } });
}

export interface StatusCounts {
  status: ContactEnquiryStatus;
  count: number;
}

export async function countsByStatus(): Promise<StatusCounts[]> {
  const grouped = await prisma.contactEnquiry.groupBy({ by: ["status"], _count: { _all: true } });
  return grouped.map((row) => ({ status: row.status, count: row._count._all }));
}
