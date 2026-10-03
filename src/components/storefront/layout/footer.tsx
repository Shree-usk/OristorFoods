import Link from "next/link";
import { Mail, MapPin, Phone } from "lucide-react";

import { contactInfo, legalLinks } from "@/lib/footer-config";
import { getResolvedFooterColumns } from "@/services/navigation.service";
import { Container } from "./container";
import { FooterColumnsGrid } from "./footer-columns-grid";
import { NewsletterForm } from "./newsletter-form";
import { SocialLinks } from "./social-links";

/**
 * Site-wide footer. Server Component — NewsletterForm is the only
 * Client Component boundary inside it (per blueprint Section 3).
 * Intentional dark variant (Charcoal bg / Ivory text) rather than the
 * light Ivory/Charcoal storefront default — see
 * docs/architecture-decisions.md for the contrast reasoning behind every
 * text color choice in here.
 *
 * `footerColumns` (STORY-052) now comes from `getResolvedFooterColumns`,
 * which reads the published Footer menu and falls back to
 * footer-config.ts's static defaults until an admin has published one.
 * contactInfo/legalLinks stay hardcoded (flagged for STORY-054).
 */
export async function Footer() {
  const footerColumns = await getResolvedFooterColumns();

  return (
    // pb-16 reserves space for the fixed mobile bottom nav (MobileNav,
    // lg:hidden) so it doesn't cover the last section when scrolled to
    // the bottom of the page — mirrors the same padding on <main>.
    <footer className="bg-charcoal text-ivory pb-16 lg:pb-0">
      <Container size="wide" className="grid gap-12 py-12 md:py-16 lg:grid-cols-[2fr_3fr]">
        <div className="space-y-6">
          <div>
            <p className="font-heading text-h4">Oristor</p>
            <p className="mt-1 text-small text-ivory/70">Feel the Difference</p>
          </div>
          <NewsletterForm />
          <SocialLinks />
        </div>

        <FooterColumnsGrid columns={footerColumns} />
      </Container>

      <div className="border-t border-ivory/10">
        <Container size="wide" className="flex flex-col gap-4 py-6 text-small text-ivory/70 sm:flex-row sm:items-center sm:justify-between">
          <address className="flex flex-col gap-1 not-italic sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <span className="font-medium text-ivory">{contactInfo.companyName}</span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              {contactInfo.address}
            </span>
            <a href={`tel:${contactInfo.phone.replace(/\s+/g, "")}`} className="flex items-center gap-1.5 hover:text-ivory">
              <Phone className="size-3.5 shrink-0" aria-hidden="true" />
              {contactInfo.phone}
            </a>
            <a href={`mailto:${contactInfo.email}`} className="flex items-center gap-1.5 hover:text-ivory">
              <Mail className="size-3.5 shrink-0" aria-hidden="true" />
              {contactInfo.email}
            </a>
          </address>
        </Container>
      </div>

      <div className="border-t border-ivory/10">
        <Container
          size="wide"
          className="flex flex-col gap-4 py-6 text-caption text-ivory/70 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>&copy; {new Date().getFullYear()} {contactInfo.companyName}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            {legalLinks.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-ivory">
                {link.label}
              </Link>
            ))}
            {/* Food-safety/quality certification badges (ISO/HACCP, etc.)
                — placeholder text pending real certification assets; swap
                for logo images once the client supplies them. */}
            <span className="rounded border border-ivory/20 px-2 py-0.5 text-caption">ISO Certified</span>
            <span className="rounded border border-ivory/20 px-2 py-0.5 text-caption">HACCP Compliant</span>
          </div>
        </Container>
      </div>
    </footer>
  );
}
