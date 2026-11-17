/**
 * Reserved categorySlug value for the "no category assigned" bucket in the
 * grouped export catalogue — not a real Category.slug. No Prisma import, so
 * this is safe to import from both server repositories/services and
 * "use client" components.
 */
export const EXPORT_CATALOGUE_UNCATEGORIZED_SLUG = "uncategorized";
