import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/storefront/account/forgot-password-form";
import { Section } from "@/components/storefront/layout/section";

export const metadata: Metadata = {
  title: "Forgot Password",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Section containerSize="narrow">
      <div className="mx-auto max-w-md">
        <h1 className="text-h2 font-heading text-charcoal">Forgot your password?</h1>
        <p className="mt-2 text-body text-charcoal/70">Enter your email and we&apos;ll send you a link to reset it.</p>
        <ForgotPasswordForm />
      </div>
    </Section>
  );
}
