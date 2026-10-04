import { ScrollReveal } from "@/components/motion";

interface ContactSocialSectionProps {
  socialLinks: { label: string; href: string }[] | null;
  phone: string;
  email: string;
}

/**
 * STORY-072. Renders socialLinks as plain text/href links — no icon
 * component crosses the Server→Client boundary, sidestepping the
 * STORY-052 serialization constraint that kept this field unwired from
 * the storefront until now, rather than solving it.
 */
export function ContactSocialSection({ socialLinks, phone, email }: ContactSocialSectionProps) {
  return (
    <ScrollReveal>
      <div className="text-center">
        <h2 className="text-h5 font-heading text-charcoal">Prefer social?</h2>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-4 text-small">
          {socialLinks?.map((link) => (
            <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="font-medium text-chilli hover:underline">
              {link.label}
            </a>
          ))}
          <a href={`mailto:${email}`} className="font-medium text-chilli hover:underline">
            Email
          </a>
          <a href={`tel:${phone}`} className="font-medium text-chilli hover:underline">
            Phone
          </a>
        </div>
      </div>
    </ScrollReveal>
  );
}
