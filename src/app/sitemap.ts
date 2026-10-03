import type { MetadataRoute } from "next";

import { buildSitemapEntries } from "@/services/sitemap.service";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return buildSitemapEntries();
}
