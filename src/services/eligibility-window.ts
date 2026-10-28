/**
 * Shared by ProductBundle and GiftOffer eligibility — "Active status and
 * inside its optional date window." Admin-visible "Scheduled" is derived
 * from this (Active + startDate in the future), never a stored third
 * status.
 */
export function isActiveAndInWindow(row: { status: "Active" | "Inactive"; startDate: Date | null; endDate: Date | null }): boolean {
  if (row.status !== "Active") return false;
  const now = new Date();
  if (row.startDate && row.startDate > now) return false;
  if (row.endDate && row.endDate < now) return false;
  return true;
}
