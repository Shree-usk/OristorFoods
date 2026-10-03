import type { Metadata } from "next";

import { ExportEnquiryForm } from "@/components/storefront/export/export-enquiry-form";
import { Section } from "@/components/storefront/layout/section";

export const metadata: Metadata = {
  title: "Export Solutions",
  description: "Partner with Oristor for global distribution — single-origin sourcing, bulk export packaging, and wholesale pricing for distributors, importers, and retailers worldwide.",
  alternates: { canonical: "/export" },
};

export default function ExportPage() {
  return (
    <Section>
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-small font-medium tracking-wide text-chilli uppercase">Export Solutions</p>
        <h1 className="mt-2 text-h1 font-heading text-charcoal">Partner with Oristor for Global Distribution</h1>
        <p className="mt-4 text-body text-charcoal/80">
          From single-origin sourcing to bulk export packaging, we work with distributors, importers, and retailers
          worldwide to bring authentic Sri Lankan food products to new markets. Tell us about your business below and
          our export team will follow up with pricing and availability.
        </p>
      </div>

      <div className="mx-auto mt-10 max-w-2xl">
        <ExportEnquiryForm />
      </div>
    </Section>
  );
}
