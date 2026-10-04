import type { ContactEnquiryStatus } from "@/generated/prisma/client";
import { checkRateLimit } from "@/lib/rate-limit";
import * as contactEnquiryRepository from "@/repositories/contact-enquiry.repository";
import type { ContactEnquiryFilters } from "@/repositories/contact-enquiry.repository";
import { ContactEnquiryNotFoundError } from "@/services/contact-enquiry.errors";
import * as exportEnquiryService from "@/services/export-enquiry.service";
import { getResolvedCompanyInfo } from "@/services/system-settings.service";
import { sendTransactionalEmail } from "@/services/notification.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import type { SubmitContactEnquiryInput } from "@/validation/contact-enquiry.schema";

/**
 * STORY-072. Covers every Contact Us enquiry except Export/International
 * Business, which routes into the existing export-enquiry.service.ts
 * pipeline (STORY-058) unmodified — see docs/architecture-decisions.md.
 * submitEnquiry is the one public, unauthenticated entry point (the
 * storefront /contact-us form); everything else requires an adminUserId.
 * A bot must not be able to tell honeypot/rate-limit/success apart — all
 * three return the same generic shape, mirroring blog.service.ts's own
 * submitComment.
 */

const SUBMISSION_RATE_LIMIT = { max: 3, windowMs: 60 * 60 * 1000 };

export interface SubmitEnquiryResult {
  submitted: boolean;
}

const GENERIC_RESULT: SubmitEnquiryResult = { submitted: true };

export async function submitEnquiry(input: SubmitContactEnquiryInput): Promise<SubmitEnquiryResult> {
  if (input.honeypot.length > 0) return GENERIC_RESULT;
  if (!checkRateLimit(`contact-enquiry:${input.contactEmail.toLowerCase()}`, SUBMISSION_RATE_LIMIT)) return GENERIC_RESULT;

  if (input.enquiryType === "Export") {
    // No new storage, no modification to export-enquiry.service.ts — its
    // own undefined-on-rate-limit return is treated identically to success,
    // same as this function's own rate-limit path above.
    await exportEnquiryService.submitEnquiry({
      companyName: input.companyName ?? "",
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      country: input.country ?? "",
      productsOfInterest: input.productInterest ?? input.message,
      volumeEstimate: input.estimatedRequirement,
      message: input.message,
    });
  } else {
    await contactEnquiryRepository.create({
      contactName: input.contactName,
      contactEmail: input.contactEmail,
      contactPhone: input.contactPhone,
      companyName: input.companyName,
      country: input.country,
      enquiryType: input.enquiryType,
      businessType: input.businessType,
      productInterest: input.productInterest,
      message: input.message,
    });
  }

  await sendConfirmationAndNotification(input);
  return GENERIC_RESULT;
}

/** Never lets a non-critical side effect (email) break the primary write — the submission above has already succeeded by the time this runs. */
async function sendConfirmationAndNotification(input: SubmitContactEnquiryInput): Promise<void> {
  try {
    const companyInfo = await getResolvedCompanyInfo();
    await sendTransactionalEmail(
      input.contactEmail,
      "Thank you for contacting ORISTOR",
      "Thank you for contacting ORISTOR. We have received your enquiry and our team will get back to you shortly.",
    );
    if (companyInfo.email) {
      const lines = [
        `Name: ${input.contactName}`,
        `Email: ${input.contactEmail}`,
        `Phone: ${input.contactPhone ?? "—"}`,
        `Enquiry type: ${input.enquiryType}`,
        `Company: ${input.companyName ?? "—"}`,
        `Country: ${input.country ?? "—"}`,
        `Message: ${input.message}`,
        `Submitted: ${new Date().toLocaleString()}`,
      ];
      await sendTransactionalEmail(companyInfo.email, `New ${input.enquiryType} enquiry — ORISTOR Contact Us`, lines.join("\n"));
    }
  } catch (error) {
    console.error("[contact-enquiry] failed to send confirmation/notification email", error);
  }
}

export async function listEnquiries(adminUserId: string, filters: ContactEnquiryFilters, page: number) {
  await requirePermission(adminUserId, "ContactEnquiries", "View");
  return contactEnquiryRepository.listForAdmin(filters, page);
}

async function requireEnquiry(id: string) {
  const enquiry = await contactEnquiryRepository.findById(id);
  if (!enquiry) throw new ContactEnquiryNotFoundError();
  return enquiry;
}

export async function getEnquiry(adminUserId: string, id: string) {
  await requirePermission(adminUserId, "ContactEnquiries", "View");
  return requireEnquiry(id);
}

export async function updateStatus(adminUserId: string, id: string, status: ContactEnquiryStatus) {
  await requirePermission(adminUserId, "ContactEnquiries", "Edit");
  await requireEnquiry(id);
  const enquiry = await contactEnquiryRepository.updateStatus(id, status);
  await writeAuditLog({ actorId: adminUserId, action: "contact_enquiry_status_updated", module: "ContactEnquiries", targetType: "ContactEnquiry", targetId: id, metadata: { status } });
  return enquiry;
}
