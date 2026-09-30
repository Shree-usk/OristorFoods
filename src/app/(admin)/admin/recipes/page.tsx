import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminRecipeListView } from "@/components/admin/recipes/admin-recipe-list-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Recipes | Admin",
  robots: { index: false, follow: false },
};

/** STORY-043. Admin authoring for the Recipe model STORY-017/018 read from. */
export default async function AdminRecipesPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Recipes" action="View">
      <AdminRecipeListView />
    </RequirePermission>
  );
}
