"use client";

import { AdminPerfectMatchPageHeader } from "@/components/admin/perfect-match/admin-perfect-match-page-header";
import { AdminPerfectMatchSettingsView } from "@/components/admin/perfect-match/admin-perfect-match-settings-view";

/** /admin/perfect-match — the Settings section (the route-nav's default/index page). */
export function AdminPerfectMatchView() {
  return (
    <div className="max-w-4xl">
      <AdminPerfectMatchPageHeader />
      <AdminPerfectMatchSettingsView />
    </div>
  );
}
