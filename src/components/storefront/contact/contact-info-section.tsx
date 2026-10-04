import { ScrollReveal } from "@/components/motion";

interface ContactInfoSectionProps {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  businessHours: string | null;
}

/** STORY-072. Real contact info only — businessHours omitted entirely, never fabricated, when no admin has configured it yet. */
export function ContactInfoSection({ companyName, address, phone, email, businessHours }: ContactInfoSectionProps) {
  return (
    <ScrollReveal>
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h3 className="text-small font-semibold tracking-wide text-charcoal uppercase">Visit us</h3>
          <p className="mt-2 text-body text-charcoal/80">{companyName}</p>
          <p className="text-body text-charcoal/80">{address}</p>
        </div>
        <div>
          <h3 className="text-small font-semibold tracking-wide text-charcoal uppercase">Call us</h3>
          <p className="mt-2 text-body text-charcoal/80">
            <a href={`tel:${phone}`} className="hover:text-chilli">
              {phone}
            </a>
          </p>
        </div>
        <div>
          <h3 className="text-small font-semibold tracking-wide text-charcoal uppercase">Email</h3>
          <p className="mt-2 text-body text-charcoal/80">
            <a href={`mailto:${email}`} className="hover:text-chilli">
              {email}
            </a>
          </p>
        </div>
        {businessHours && (
          <div>
            <h3 className="text-small font-semibold tracking-wide text-charcoal uppercase">Business hours</h3>
            <p className="mt-2 text-body text-charcoal/80">{businessHours}</p>
          </div>
        )}
      </div>
    </ScrollReveal>
  );
}
