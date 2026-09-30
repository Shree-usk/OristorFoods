import * as homepageLayoutRepository from "@/repositories/homepage-layout.repository";
import type { HomepageLayoutDetail } from "@/repositories/homepage-layout.repository";

/**
 * Storefront-facing read only — no permission gate, mirrors the
 * product.service.ts / product-admin.service.ts split. Returns null
 * before any layout has ever been published, which src/app/(storefront)/
 * page.tsx treats as "render the original fixture-driven defaults" so
 * this migration never leaves the homepage blank (see
 * docs/architecture-decisions.md).
 */
export function getPublishedHomepageLayout(): Promise<HomepageLayoutDetail | null> {
  return homepageLayoutRepository.findPublishedLayout();
}
