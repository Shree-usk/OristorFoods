"use client";

import { AdminFoodAcademyCategoriesView } from "@/components/admin/food-academy/admin-food-academy-categories-view";
import { AdminFoodAcademyPageHeader } from "@/components/admin/food-academy/admin-food-academy-page-header";

export function AdminFoodAcademyCategoriesPageView() {
  return (
    <div className="max-w-4xl">
      <AdminFoodAcademyPageHeader />
      <AdminFoodAcademyCategoriesView />
    </div>
  );
}
