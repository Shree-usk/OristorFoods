import type { Metadata } from "next";

import { DeactivateAccountDialog } from "@/components/storefront/account/deactivate-account-dialog";
import { EmailChangeForm } from "@/components/storefront/account/email-change-form";
import { ProfileForm } from "@/components/storefront/account/profile-form";

export const metadata: Metadata = {
  title: "Profile",
  robots: { index: false, follow: false },
};

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-h2 font-heading text-charcoal">Profile</h1>
        <div className="mt-6 max-w-lg">
          <ProfileForm />
        </div>
      </div>

      <div className="border-t border-input pt-6">
        <h2 className="text-h3 font-heading text-charcoal">Email address</h2>
        <div className="mt-4 max-w-lg">
          <EmailChangeForm />
        </div>
      </div>

      <div className="border-t border-input pt-6">
        <h2 className="text-h3 font-heading text-destructive">Danger zone</h2>
        <p className="mt-2 max-w-lg text-small text-charcoal/70">Request that your account be deactivated. Our team reviews every request before it takes effect.</p>
        <div className="mt-4">
          <DeactivateAccountDialog />
        </div>
      </div>
    </div>
  );
}
