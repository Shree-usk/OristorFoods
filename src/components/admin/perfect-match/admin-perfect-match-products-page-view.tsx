"use client";

import { AdminPerfectMatchPageHeader } from "@/components/admin/perfect-match/admin-perfect-match-page-header";
import { AdminPerfectMatchProductsView } from "@/components/admin/perfect-match/admin-perfect-match-products-view";

export function AdminPerfectMatchProductsPageView() {
  return (
    <div className="max-w-4xl">
      <AdminPerfectMatchPageHeader />
      <AdminPerfectMatchProductsView />
    </div>
  );
}
