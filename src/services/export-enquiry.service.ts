import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";

import type { ExportEnquiryStatus } from "@/generated/prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import * as adminUserRepository from "@/repositories/admin-user.repository";
import * as auditLogRepository from "@/repositories/audit-log.repository";
import * as distributorAccountRepository from "@/repositories/distributor-account.repository";
import * as exportEnquiryRepository from "@/repositories/export-enquiry.repository";
import type { CreateExportEnquiryInput, ExportEnquiryFilters } from "@/repositories/export-enquiry.repository";
import * as userRepository from "@/repositories/user.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requestPasswordReset } from "@/services/auth.service";
import { EnquiryNotFoundError, EnquiryNotWonError, InvalidStatusTransitionError } from "@/services/export-enquiry.errors";
import { sendTransactionalEmail } from "@/services/notification.service";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-058. Export Portal — permission-gated (ExportPortal, View/Edit/
 * Approve) and audit-logged. `submitEnquiry` is the one public,
 * unauthenticated entry point (the storefront /export form); every
 * other export here requires an adminUserId.
 */

const SUBMISSION_RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

const VALID_TRANSITIONS: Record<ExportEnquiryStatus, ExportEnquiryStatus[]> = {
  New: ["InDiscussion", "Lost"],
  InDiscussion: ["Quoted", "Lost"],
  Quoted: ["Won", "Lost"],
  Won: [],
  Lost: [],
};

export async function submitEnquiry(input: CreateExportEnquiryInput) {
  if (!checkRateLimit(`export-enquiry:${input.contactEmail.toLowerCase()}`, SUBMISSION_RATE_LIMIT)) return;
  return exportEnquiryRepository.create(input);
}

export async function listEnquiries(adminUserId: string, filters: ExportEnquiryFilters, page: number) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return exportEnquiryRepository.listForAdmin(filters, page);
}

async function requireEnquiry(id: string) {
  const enquiry = await exportEnquiryRepository.findById(id);
  if (!enquiry) throw new EnquiryNotFoundError();
  return enquiry;
}

export async function getEnquiryDetail(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return requireEnquiry(id);
}

/** Reuses the shared AuditLog table directly (not audit-log-admin.service.ts's listAuditLogs, which is gated on a different module's permission) so an Export Manager with only ExportPortal:View can see their own enquiry's timeline. */
export async function getEnquiryActivity(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  await requireEnquiry(id);
  const { rows } = await auditLogRepository.list({ targetId: id }, 1);
  return rows;
}

export async function updateEnquiryStatus(adminUserId: string, id: string, status: ExportEnquiryStatus) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const enquiry = await requireEnquiry(id);

  if (!VALID_TRANSITIONS[enquiry.status].includes(status)) {
    throw new InvalidStatusTransitionError(enquiry.status, status);
  }

  const updated = await exportEnquiryRepository.updateStatus(id, status);
  await writeAuditLog({ actorId: adminUserId, action: "export_enquiry_status_changed", module: "ExportPortal", targetType: "ExportEnquiry", targetId: id, metadata: { from: enquiry.status, to: status } });
  return updated;
}

/**
 * A minimal admin list for the assignee picker, gated on ExportPortal:Edit
 * rather than reusing admin-user-admin.service.ts's listUsersForAdmin
 * (which requires UsersRolesAudit:View) — an Export Manager shouldn't
 * need an unrelated module's permission just to see assignable staff.
 */
export async function listAssignableAdmins(adminUserId: string) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const admins = await adminUserRepository.listAll();
  return admins.map((admin) => ({ id: admin.id, name: admin.name, email: admin.email }));
}

export async function assignEnquiry(adminUserId: string, id: string, assignedToId: string | null) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  await requireEnquiry(id);

  const updated = await exportEnquiryRepository.assign(id, assignedToId);
  await writeAuditLog({ actorId: adminUserId, action: "export_enquiry_assigned", module: "ExportPortal", targetType: "ExportEnquiry", targetId: id, metadata: { assignedToId } });
  return updated;
}

export async function addNote(adminUserId: string, id: string, body: string) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  await requireEnquiry(id);

  const note = await exportEnquiryRepository.addNote(id, adminUserId, body);
  await writeAuditLog({ actorId: adminUserId, action: "export_enquiry_note_added", module: "ExportPortal", targetType: "ExportEnquiry", targetId: id });
  return note;
}

export async function replyToEnquiry(adminUserId: string, id: string, subject: string, body: string) {
  await requirePermission(adminUserId, "ExportPortal", "Edit");
  const enquiry = await requireEnquiry(id);

  await sendTransactionalEmail(enquiry.contactEmail, subject, body);
  await writeAuditLog({ actorId: adminUserId, action: "export_enquiry_replied", module: "ExportPortal", targetType: "ExportEnquiry", targetId: id, metadata: { subject } });
}

export interface ConvertEnquiryInput {
  region: string;
}

/**
 * Gated on Approve, not Edit — a one-way conversion that grants a new
 * entitlement (CustomerGroup.Distributor pricing), the same convention
 * this codebase reserves Approve for elsewhere (publish-approval,
 * reward grants), distinct from customer-admin.service.ts's plain
 * setCustomerGroup (Edit), which isn't itself a conversion.
 */
export async function convertToDistributorAccount(adminUserId: string, id: string, input: ConvertEnquiryInput) {
  await requirePermission(adminUserId, "ExportPortal", "Approve");
  const enquiry = await requireEnquiry(id);
  if (enquiry.status !== "Won") throw new EnquiryNotWonError();

  const existingUser = await userRepository.findByEmail(enquiry.contactEmail);
  const newUserPasswordHash = existingUser ? null : await bcrypt.hash(randomBytes(32).toString("hex"), 10);

  const result = await distributorAccountRepository.convertEnquiryToDistributorAccount({
    enquiryId: id,
    companyName: enquiry.companyName,
    region: input.region,
    contactName: enquiry.contactName,
    contactEmail: enquiry.contactEmail,
    contactPhone: enquiry.contactPhone,
    createdById: adminUserId,
    existingUserId: existingUser?.id ?? null,
    newUserPasswordHash,
  });

  if (result.createdNewUser) {
    await requestPasswordReset(enquiry.contactEmail);
  }

  await writeAuditLog({ actorId: adminUserId, action: "export_enquiry_converted", module: "ExportPortal", targetType: "ExportEnquiry", targetId: id, metadata: { distributorAccountId: result.account.id, userId: result.userId } });
  return result.account;
}

export async function listDistributorAccounts(adminUserId: string) {
  await requirePermission(adminUserId, "ExportPortal", "View");
  return distributorAccountRepository.listAll();
}
