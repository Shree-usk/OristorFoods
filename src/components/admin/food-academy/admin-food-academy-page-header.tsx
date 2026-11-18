import { AdminFoodAcademyNav } from "@/components/admin/food-academy/admin-food-academy-nav";

export function AdminFoodAcademyPageHeader() {
  return (
    <div className="mb-6 space-y-4">
      <div>
        <h1 className="text-h2 font-heading text-charcoal">Food Academy</h1>
        <p className="mt-1 text-small text-muted-foreground">Manage the /food-academy page&apos;s hero, learning categories, entries, and section copy.</p>
      </div>
      <AdminFoodAcademyNav />
    </div>
  );
}
