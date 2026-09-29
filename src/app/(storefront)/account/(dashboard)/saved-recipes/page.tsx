import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { SavedRecipesView } from "@/components/storefront/account/saved-recipes-view";
import { getSavedRecipesForCustomer } from "@/services/customer-saved-recipes.service";

export const metadata: Metadata = {
  title: "Saved Recipes",
  robots: { index: false, follow: false },
};

/** STORY-037. Server Component — reads STORY-022's recipe-bookmark.service.ts directly (no Prisma access here, per the AC). */
export default async function SavedRecipesPage() {
  const session = await auth();
  const userId = session!.user.id;

  const items = await getSavedRecipesForCustomer(userId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-h2 font-heading text-charcoal">Saved Recipes</h1>
      <SavedRecipesView initialItems={items} />
    </div>
  );
}
