/**
 * STORY-051a. Pure, framework-agnostic so it's importable from both the
 * client-side SeoFieldsPanel and a unit test — keeping it out of
 * seo.service.ts deliberately, since that file transitively imports the
 * (Node-only) Prisma client and would break a client bundle.
 *
 * STORY-051d's central, filterable list of all pages by health status
 * reuses this same function per-row — the per-page checklist and the
 * central audit are one set of rules, not two.
 */

export interface SeoHealthInput {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
  ogImageWidth?: number | null;
  ogImageHeight?: number | null;
}

export interface SeoHealthCheck {
  id: "missingDescription" | "titleLength" | "missingOgAlt" | "noCanonical" | "ogImageTooSmall";
  label: string;
  ok: boolean;
}

const TITLE_MIN = 50;
const TITLE_MAX = 60;
// The standard Open-Graph-rich-preview minimum (Facebook/Twitter/LinkedIn
// card requirements all converge around this).
const OG_IMAGE_MIN_WIDTH = 1200;
const OG_IMAGE_MIN_HEIGHT = 630;

export function computeSeoHealth(input: SeoHealthInput): SeoHealthCheck[] {
  const titleLength = input.metaTitle?.length ?? 0;
  const titleOk = titleLength === 0 ? true : titleLength >= TITLE_MIN && titleLength <= TITLE_MAX;

  // No image set, or no recorded dimensions for it (an admin typed a URL by
  // hand rather than picking one) — nothing to flag either way, same
  // convention missingOgAlt already uses for "no image set".
  const dimensionsKnown = input.ogImageWidth != null && input.ogImageHeight != null;
  const ogImageOk = !input.ogImageUrl || !dimensionsKnown || (input.ogImageWidth! >= OG_IMAGE_MIN_WIDTH && input.ogImageHeight! >= OG_IMAGE_MIN_HEIGHT);

  return [
    { id: "missingDescription", label: "Meta description is set", ok: Boolean(input.metaDescription) },
    { id: "titleLength", label: `Meta title is ${TITLE_MIN}-${TITLE_MAX} characters`, ok: titleOk },
    { id: "missingOgAlt", label: "Social image has alt text", ok: !input.ogImageUrl || Boolean(input.ogImageAlt) },
    { id: "noCanonical", label: "Canonical URL is set", ok: Boolean(input.canonicalUrl) },
    { id: "ogImageTooSmall", label: `Social image is at least ${OG_IMAGE_MIN_WIDTH}x${OG_IMAGE_MIN_HEIGHT}`, ok: ogImageOk },
  ];
}
