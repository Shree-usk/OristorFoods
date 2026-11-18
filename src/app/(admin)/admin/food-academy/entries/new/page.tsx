import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminFoodAcademyEntryForm } from "@/components/admin/food-academy/admin-food-academy-entry-form";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "New Food Academy Entry | Admin",
  robots: { index: false, follow: false },
};

export default async function NewAdminFoodAcademyEntryPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="FoodAcademy" action="Edit">
      <AdminFoodAcademyEntryForm />
    </RequirePermission>
  );
}
