/**
 * STORY-051a. Pure, framework-agnostic so it's importable from both the
 * client-side SeoFieldsPanel and a unit test — keeping it out of
 * seo.service.ts deliberately, since that file transitively imports the
 * (Node-only) Prisma client and would break a client bundle.
 *
 * The AC's *central, filterable* list of all pages by health status is
 * STORY-051d's job, not this one — this is just the per-page checklist.
 */

export interface SeoHealthInput {
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  ogImageAlt: string | null;
}

export interface SeoHealthCheck {
  id: "missingDescription" | "titleLength" | "missingOgAlt" | "noCanonical";
  label: string;
  ok: boolean;
}

const TITLE_MIN = 50;
const TITLE_MAX = 60;

export function computeSeoHealth(input: SeoHealthInput): SeoHealthCheck[] {
  const titleLength = input.metaTitle?.length ?? 0;
  const titleOk = titleLength === 0 ? true : titleLength >= TITLE_MIN && titleLength <= TITLE_MAX;

  return [
    { id: "missingDescription", label: "Meta description is set", ok: Boolean(input.metaDescription) },
    { id: "titleLength", label: `Meta title is ${TITLE_MIN}-${TITLE_MAX} characters`, ok: titleOk },
    { id: "missingOgAlt", label: "Social image has alt text", ok: !input.ogImageUrl || Boolean(input.ogImageAlt) },
    { id: "noCanonical", label: "Canonical URL is set", ok: Boolean(input.canonicalUrl) },
  ];
}
