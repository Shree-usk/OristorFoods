import type { Metadata } from "next";

import { NotificationPreferencesForm } from "@/components/storefront/account/notification-preferences-form";

export const metadata: Metadata = {
  title: "Notification Preferences",
  robots: { index: false, follow: false },
};

export default function NotificationsPage() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Notifications</h1>
      <p className="mt-2 text-body text-charcoal/70">Choose what Oristor contacts you about, and how.</p>
      <div className="mt-6 max-w-lg">
        <NotificationPreferencesForm />
      </div>
    </div>
  );
}
