import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/storefront/account/reset-password-form";
import { Section } from "@/components/storefront/layout/section";

export const metadata: Metadata = {
  title: "Reset Password",
  robots: { index: false, follow: false },
};

export default function ResetPasswordPage() {
  return (
    <Section containerSize="narrow">
      <div className="mx-auto max-w-md">
        <h1 className="text-h2 font-heading text-charcoal">Reset your password</h1>
        {/* ResetPasswordForm reads ?token/?email via useSearchParams — Next requires a Suspense boundary around that in prerendered builds. */}
        <Suspense>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </Section>
  );
}
