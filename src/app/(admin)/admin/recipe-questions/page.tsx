import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminRecipeQaQueueView } from "@/components/admin/recipe-qa/admin-recipe-qa-queue-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Recipe Q&A | Admin",
  robots: { index: false, follow: false },
};

/** STORY-046.1. A separate, isolated console from Product Q&A (/admin/questions) — not merged, per spec. Gates on the existing QA module. */
export default async function AdminRecipeQuestionsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="QA" action="View">
      <AdminRecipeQaQueueView />
    </RequirePermission>
  );
}
