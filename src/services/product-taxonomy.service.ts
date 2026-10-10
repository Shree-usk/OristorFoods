import * as productRepository from "@/repositories/product.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { requirePermission } from "@/services/permission.service";
import { AllergenNameConflictError, AllergenNotFoundError, CertificationNotFoundError } from "@/services/product-taxonomy.errors";

/**
 * Allergen and Certification — simple, flat reference tables (no
 * hierarchy, unlike Category) that are always edited together on the one
 * admin screen (/admin/certifications), so one small service file covers
 * both rather than two near-empty files. Gated on the existing `Products`
 * module — same reasoning as category.service.ts: this is product
 * reference data, not a standalone admin section.
 */

export async function listAllergensForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Products", "View");
  return productRepository.listAllergens();
}

export async function createAllergenAdmin(adminUserId: string, input: { name: string; icon?: string | null }) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await productRepository.findAllergenByName(input.name);
  if (existing) throw new AllergenNameConflictError();

  const allergen = await productRepository.createAllergen({ name: input.name, icon: input.icon || null });
  await writeAuditLog({ actorId: adminUserId, action: "allergen_created", module: "Products", targetType: "Allergen", targetId: allergen.id });
  return allergen;
}

export async function updateAllergenAdmin(adminUserId: string, id: string, input: { name?: string; icon?: string | null }) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await productRepository.findAllergenById(id);
  if (!existing) throw new AllergenNotFoundError();
  if (input.name) {
    const conflict = await productRepository.findAllergenByName(input.name);
    if (conflict && conflict.id !== id) throw new AllergenNameConflictError();
  }

  const allergen = await productRepository.updateAllergen(id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.icon !== undefined && { icon: input.icon || null }),
  });
  await writeAuditLog({ actorId: adminUserId, action: "allergen_updated", module: "Products", targetType: "Allergen", targetId: id });
  return allergen;
}

export async function listCertificationsForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "Products", "View");
  return productRepository.listCertifications();
}

export async function createCertificationAdmin(adminUserId: string, input: { name: string; certificateImage?: string | null; documentUrl?: string | null }) {
  await requirePermission(adminUserId, "Products", "Edit");
  const certification = await productRepository.createCertification({
    name: input.name,
    certificateImage: input.certificateImage || null,
    documentUrl: input.documentUrl || null,
  });
  await writeAuditLog({ actorId: adminUserId, action: "certification_created", module: "Products", targetType: "Certification", targetId: certification.id });
  return certification;
}

export async function updateCertificationAdmin(adminUserId: string, id: string, input: { name?: string; certificateImage?: string | null; documentUrl?: string | null }) {
  await requirePermission(adminUserId, "Products", "Edit");
  const existing = await productRepository.findCertificationById(id);
  if (!existing) throw new CertificationNotFoundError();

  const certification = await productRepository.updateCertification(id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.certificateImage !== undefined && { certificateImage: input.certificateImage || null }),
    ...(input.documentUrl !== undefined && { documentUrl: input.documentUrl || null }),
  });
  await writeAuditLog({ actorId: adminUserId, action: "certification_updated", module: "Products", targetType: "Certification", targetId: id });
  return certification;
}
