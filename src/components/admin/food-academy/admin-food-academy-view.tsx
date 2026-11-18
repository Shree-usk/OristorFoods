"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminFoodAcademyCategoriesView } from "@/components/admin/food-academy/admin-food-academy-categories-view";
import { AdminFoodAcademyPageSettingsView } from "@/components/admin/food-academy/admin-food-academy-page-settings-view";

/** Admin editor for the /food-academy page. Entries management lands in a later stage. */
export function AdminFoodAcademyView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-h2 font-heading text-charcoal">Food Academy</h1>
        <p className="mt-1 text-small text-muted-foreground">Manage the /food-academy page&apos;s hero, learning categories, and section copy.</p>
      </div>

      <Tabs defaultValue="page-settings">
        <TabsList>
          <TabsTrigger value="page-settings">Page settings</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>
        <TabsContent value="page-settings" className="mt-6">
          <AdminFoodAcademyPageSettingsView />
        </TabsContent>
        <TabsContent value="categories" className="mt-6">
          <AdminFoodAcademyCategoriesView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
