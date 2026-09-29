import type { Metadata } from "next";

import { RegisterForm } from "@/components/storefront/account/register-form";
import { Section } from "@/components/storefront/layout/section";

export const metadata: Metadata = {
  title: "Create Account",
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <Section containerSize="narrow">
      <div className="mx-auto max-w-md">
        <h1 className="text-h2 font-heading text-charcoal">Create your account</h1>
        <p className="mt-2 text-body text-charcoal/70">Track orders, save addresses, and earn rewards on every purchase.</p>
        <RegisterForm />
      </div>
    </Section>
  );
}
