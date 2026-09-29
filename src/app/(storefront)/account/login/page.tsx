import type { Metadata } from "next";

import { LoginForm } from "@/components/storefront/account/login-form";
import { Section } from "@/components/storefront/layout/section";

export const metadata: Metadata = {
  title: "Sign In",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  return (
    <Section containerSize="narrow">
      <div className="mx-auto max-w-md">
        <h1 className="text-h2 font-heading text-charcoal">Sign in</h1>
        <LoginForm />
      </div>
    </Section>
  );
}
