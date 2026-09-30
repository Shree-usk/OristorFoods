import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminRecipeForm } from "@/components/admin/recipes/admin-recipe-form";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Recipe | Admin",
  robots: { index: false, follow: false },
};

export default async function EditAdminRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="Recipes" action="Edit">
      <AdminRecipeForm recipeId={id} />
    </RequirePermission>
  );
}
