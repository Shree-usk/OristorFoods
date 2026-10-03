import { JsonLdScript } from "@/components/storefront/product/json-ld-script";
import { SITE_URL } from "@/lib/site-url";

/**
 * STORY-051c. Site identity, not per-page content — static rather than
 * admin-editable (no entity for a single sitewide record to attach to;
 * STORY-054 System Settings is the natural future home if this ever
 * needs to be admin-configurable). Rendered once, in the root layout.
 *
 * `logo` is deliberately omitted (optional in schema.org's own spec) —
 * confirmed no logo file exists at any stable, public, absolute-URL-
 * resolvable path yet (the real logo is a webpack-bundled static import,
 * `src/assets/logo/Logo.png`, used only via `next/image` in
 * `src/components/storefront/layout/logo.tsx`; fabricating a guessed
 * `public/` path here would just 404). Add it once a logo file actually
 * lives under `public/` at a fixed path.
 */
export function OrganizationJsonLd() {
  return (
    <JsonLdScript
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "Oristor Food Products (Pvt) Ltd",
        url: SITE_URL,
        description: "Premium Sri Lankan food — authentic heritage, delivered with an enterprise-grade digital experience.",
      }}
    />
  );
}
