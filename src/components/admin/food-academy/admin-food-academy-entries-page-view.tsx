"use client";

import { AdminFoodAcademyEntriesView } from "@/components/admin/food-academy/admin-food-academy-entries-view";
import { AdminFoodAcademyPageHeader } from "@/components/admin/food-academy/admin-food-academy-page-header";

export function AdminFoodAcademyEntriesPageView() {
  return (
    <div>
      <AdminFoodAcademyPageHeader />
      <AdminFoodAcademyEntriesView />
    </div>
  );
}
