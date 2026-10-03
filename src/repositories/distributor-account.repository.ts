import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import * as userRepository from "@/repositories/user.repository";

/** STORY-058. The only place DistributorAccount is queried/mutated. */

type Client = Prisma.TransactionClient | typeof prisma;

export interface CreateDistributorAccountInput {
  companyName: string;
  region: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  userId: string;
  convertedFromEnquiryId: string;
  createdById: string;
}

export function create(input: CreateDistributorAccountInput, client: Client = prisma) {
  return client.distributorAccount.create({ data: input });
}

export interface ConvertEnquiryInput {
  enquiryId: string;
  companyName: string;
  region: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string | null;
  createdById: string;
  /** Set by the service when a User already exists for contactEmail — skips creating a new one. */
  existingUserId: string | null;
  /** Required when existingUserId is null — a random, unusable placeholder hash the service generates (mirrors STORY-057's admin-invite pattern); the real password is set later via requestPasswordReset. */
  newUserPasswordHash: string | null;
}

/**
 * Atomic: find-or-create the linked User, set their customerGroup to
 * Distributor (so they get STORY-071's CustomerGroupPrice tiered
 * pricing at checkout), then create the DistributorAccount row. Sending
 * the password-reset email for a newly-created User happens outside
 * this transaction, in the service, since an email send isn't
 * transactional/reversible.
 */
export async function convertEnquiryToDistributorAccount(input: ConvertEnquiryInput) {
  return prisma.$transaction(async (tx) => {
    let userId = input.existingUserId;
    if (!userId) {
      const user = await userRepository.create(
        { name: input.contactName, email: input.contactEmail, passwordHash: input.newUserPasswordHash!, marketingOptIn: false, passwordChangedAt: new Date() },
        tx,
      );
      userId = user.id;
    }
    await userRepository.updateCustomerGroup(userId, "Distributor", tx);

    const account = await create(
      {
        companyName: input.companyName,
        region: input.region,
        contactName: input.contactName,
        contactEmail: input.contactEmail,
        contactPhone: input.contactPhone,
        userId,
        convertedFromEnquiryId: input.enquiryId,
        createdById: input.createdById,
      },
      tx,
    );

    return { account, userId, createdNewUser: !input.existingUserId };
  });
}

export function listAll() {
  return prisma.distributorAccount.findMany({
    include: {
      user: { select: { id: true, email: true, customerGroup: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      convertedFromEnquiry: { select: { id: true, companyName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
