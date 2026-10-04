import type { Metadata } from "next";

import { JsonLdScript } from "@/components/storefront/product/json-ld-script";
import { ContactEnquiryForm } from "@/components/storefront/contact/contact-enquiry-form";
import { ContactHero } from "@/components/storefront/contact/contact-hero";
import { ContactInfoSection } from "@/components/storefront/contact/contact-info-section";
import { ContactLocationSection } from "@/components/storefront/contact/contact-location-section";
import { ContactSocialSection } from "@/components/storefront/contact/contact-social-section";
import { Section } from "@/components/storefront/layout/section";
import { getResolvedCompanyInfo } from "@/services/system-settings.service";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Let's talk about good food. From authentic Sri Lankan flavours to international partnerships, product questions, or wholesale and export enquiries — get in touch with ORISTOR.",
  alternates: { canonical: "/contact-us" },
};

export default async function ContactUsPage() {
  const companyInfo = await getResolvedCompanyInfo();

  return (
    <>
      <JsonLdScript
        data={{
          "@context": "https://schema.org",
          "@type": "Organization",
          name: companyInfo.companyName,
          email: companyInfo.email,
          telephone: companyInfo.phone,
          address: { "@type": "PostalAddress", streetAddress: companyInfo.address },
        }}
      />

      <ContactHero />

      <Section>
        <ContactInfoSection companyName={companyInfo.companyName} address={companyInfo.address} phone={companyInfo.phone} email={companyInfo.email} businessHours={companyInfo.businessHours} />
      </Section>

      <Section className="bg-cream">
        <div className="mx-auto max-w-2xl">
          <ContactEnquiryForm />
        </div>
      </Section>

      <Section>
        <ContactLocationSection address={companyInfo.address} />
      </Section>

      <Section spacing="sm">
        <ContactSocialSection socialLinks={companyInfo.socialLinks} phone={companyInfo.phone} email={companyInfo.email} />
      </Section>
    </>
  );
}
