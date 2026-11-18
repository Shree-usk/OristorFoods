import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminFoodAcademyView } from "@/components/admin/food-academy/admin-food-academy-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Food Academy | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminFoodAcademyPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="FoodAcademy" action="View">
      <AdminFoodAcademyView />
    </RequirePermission>
  );
}
