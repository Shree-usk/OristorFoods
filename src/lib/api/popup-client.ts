/** STORY-050a. Storefront-facing fetch wrappers — /api/popups/*. */

export type PopupPageTargetValue = "AllPages" | "Homepage" | "Products" | "Recipes" | "Blog";
export type PopupInteractionTypeValue = "Impression" | "Click" | "Dismissal";

export type PopupTriggerTypeValue = "Immediate" | "TimeDelay" | "ScrollDepth" | "ExitIntent" | "PageViews" | "AddToCart" | "BeforeCheckout";

export interface EligiblePopup {
  id: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  mobileImageUrl: string | null;
  mobileImageAlt: string | null;
  videoUrl: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  couponCode: string | null;
  triggerType: PopupTriggerTypeValue;
  triggerValue: number | null;
  frequencyCap: string;
}

export async function fetchEligiblePopup(page: PopupPageTargetValue): Promise<EligiblePopup | null> {
  const response = await fetch(`/api/popups/eligible?page=${page}`);
  if (!response.ok) return null;
  const body = await response.json();
  return body.popup ?? null;
}

export async function recordPopupInteraction(popupId: string, type: PopupInteractionTypeValue): Promise<void> {
  try {
    await fetch(`/api/popups/${popupId}/interactions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type }) });
  } catch {
    // Best-effort — a storefront visitor's experience never depends on this succeeding.
  }
}
