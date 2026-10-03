import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site-url";

/**
 * STORY-051c. Static, no DB dependency — "stays in sync with redirect
 * settings" is satisfied by the real HTTP redirect behavior itself
 * (STORY-051b, already live in src/proxy.ts): a crawler hitting a
 * redirected path gets redirected regardless of what's in this file.
 * robots.txt disallow is about preventing crawling, not tracking
 * individual redirects.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/account", "/cart", "/checkout", "/api"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
