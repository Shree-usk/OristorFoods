import type { Metadata } from "next";
import { Suspense } from "react";

import { Section } from "@/components/storefront/layout/section";
import { VerifyEmailPanel } from "@/components/storefront/account/verify-email-panel";

export const metadata: Metadata = {
  title: "Confirm Email",
  robots: { index: false, follow: false },
};

export default function VerifyEmailPage() {
  return (
    <Section containerSize="narrow">
      <div className="mx-auto max-w-md">
        <h1 className="text-h2 font-heading text-charcoal">Confirm your email</h1>
        {/* VerifyEmailPanel reads ?userId/?token via useSearchParams — Next requires a Suspense boundary around that in prerendered builds. */}
        <Suspense>
          <VerifyEmailPanel />
        </Suspense>
      </div>
    </Section>
  );
}
