"use client";

import { AdminFoodAcademyPageHeader } from "@/components/admin/food-academy/admin-food-academy-page-header";
import { AdminFoodAcademyPageSettingsView } from "@/components/admin/food-academy/admin-food-academy-page-settings-view";

/** /admin/food-academy — the Page settings section (the route-nav's default/index page). */
export function AdminFoodAcademyView() {
  return (
    <div className="max-w-4xl">
      <AdminFoodAcademyPageHeader />
      <AdminFoodAcademyPageSettingsView />
    </div>
  );
}
