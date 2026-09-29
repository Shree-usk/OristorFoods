import type { Metadata } from "next";
import { Suspense } from "react";

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
        {/* LoginForm reads ?callbackUrl via useSearchParams — Next requires a Suspense boundary around that in prerendered builds. */}
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </Section>
  );
}
