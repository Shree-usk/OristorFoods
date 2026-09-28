import type { Metadata } from "next";

import { CheckoutWizard } from "@/components/storefront/checkout/checkout-wizard";
import { Section } from "@/components/storefront/layout/section";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Complete your Oristor order — delivery address, delivery method, payment, and review.",
  robots: { index: false },
};

export default function CheckoutPage() {
  return (
    <Section>
      <h1 className="text-h1 font-heading text-charcoal">Checkout</h1>
      <CheckoutWizard />
    </Section>
  );
}
