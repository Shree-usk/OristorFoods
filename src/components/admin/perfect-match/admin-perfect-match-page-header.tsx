import { AdminPerfectMatchNav } from "@/components/admin/perfect-match/admin-perfect-match-nav";

export function AdminPerfectMatchPageHeader() {
  return (
    <div className="mb-6 space-y-4">
      <div>
        <h1 className="text-h2 font-heading text-charcoal">The Perfect Match</h1>
        <p className="mt-1 text-small text-muted-foreground">Manage the homepage section&apos;s intro copy, selected products, and each product&apos;s meal pairings.</p>
      </div>
      <AdminPerfectMatchNav />
    </div>
  );
}
