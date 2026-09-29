import type { Metadata } from "next";

import { ChangePasswordForm } from "@/components/storefront/account/change-password-form";
import { LogoutAllDevicesButton } from "@/components/storefront/account/logout-all-devices-button";

export const metadata: Metadata = {
  title: "Security",
  robots: { index: false, follow: false },
};

export default function SecurityPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h2 font-heading text-charcoal">Security</h1>
        <div className="mt-6 max-w-lg">
          <ChangePasswordForm />
        </div>
      </div>

      <div className="border-t border-input pt-6">
        <h2 className="text-h3 font-heading text-charcoal">Sessions</h2>
        <p className="mt-2 max-w-lg text-small text-charcoal/70">
          Sign out everywhere, including this device — useful if you think someone else has access to your account.
        </p>
        <div className="mt-4">
          <LogoutAllDevicesButton />
        </div>
      </div>
    </div>
  );
}
