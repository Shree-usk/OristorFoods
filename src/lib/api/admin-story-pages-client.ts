/** STORY-074. Fetch wrappers for /api/admin/story-pages/[page]. */

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

export type StoryBlockTypeValue = "Hero" | "Chapter" | "IngredientItem" | "ProductCategoryItem" | "ValueItem" | "GlobalJourney" | "Cta";
export type ContentAlignmentValue = "Left" | "Center" | "Right";

export interface StoryPageBlock {
  id: string;
  page: "AboutUs";
  blockType: StoryBlockTypeValue;
  blockKey: string;
  sortOrder: number;
  eyebrow: string | null;
  title: string | null;
  body: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaHref: string | null;
  align: ContentAlignmentValue | null;
  letter: string | null;
}

export type StoryPageBlockInput = Pick<
  StoryPageBlock,
  "blockKey" | "blockType" | "sortOrder" | "eyebrow" | "title" | "body" | "imageUrl" | "imageAlt" | "ctaLabel" | "ctaHref" | "secondaryCtaLabel" | "secondaryCtaHref" | "align" | "letter"
>;

export async function fetchStoryPageBlocks(page: "AboutUs"): Promise<StoryPageBlock[]> {
  const response = await fetch(`/api/admin/story-pages/${page}`);
  if (!response.ok) throw new Error(`Failed to load ${page} content (${response.status})`);
  return response.json();
}

export async function saveStoryPageBlocks(page: "AboutUs", blocks: StoryPageBlockInput[]): Promise<StoryPageBlock[]> {
  const response = await fetch(`/api/admin/story-pages/${page}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ blocks }),
  });
  await assertOkWithServerMessage(response, "Failed to save page content.");
  return response.json();
}

export interface ContactPageCopy {
  contactHeroEyebrow: string | null;
  contactHeroHeadline: string | null;
  contactHeroSubcopy: string | null;
  contactLocationHeading: string | null;
}

/**
 * Gated on StoryPages, not SystemSettings — see story-page.service.ts's
 * getContactPageCopyForAdmin/saveContactPageCopy. A role granted
 * StoryPages edits both this page's tabs under one permission.
 */
export async function fetchContactPageCopy(): Promise<ContactPageCopy | null> {
  const response = await fetch("/api/admin/story-pages/contact-copy");
  if (!response.ok) throw new Error(`Failed to load Contact page copy (${response.status})`);
  return response.json();
}

export async function saveContactPageCopy(input: ContactPageCopy): Promise<ContactPageCopy> {
  const response = await fetch("/api/admin/story-pages/contact-copy", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to save Contact page copy.");
  return response.json();
}
