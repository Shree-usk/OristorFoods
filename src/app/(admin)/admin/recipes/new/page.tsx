import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminRecipeForm } from "@/components/admin/recipes/admin-recipe-form";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "New Recipe | Admin",
  robots: { index: false, follow: false },
};

export default async function NewAdminRecipePage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Recipes" action="Edit">
      <AdminRecipeForm />
    </RequirePermission>
  );
}
