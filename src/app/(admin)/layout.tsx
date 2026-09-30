import { redirect } from "next/navigation";

import { adminAuth } from "@/lib/admin-auth";
import { AdminSignOutButton } from "@/components/admin/admin-sign-out-button";
import * as adminUserRepository from "@/repositories/admin-user.repository";

/**
 * STORY-038. Diverges from the storefront layout so auth rules (this
 * RBAC gate) and chrome can differ without sharing a URL prefix. Defense
 * in depth alongside src/proxy.ts's own redirect — a signed-in admin here
 * is not the same as being authorized for any specific action; that's
 * permission.service.ts::requirePermission's job, enforced server-side in
 * every protected Service/route, never by this layout or a hidden button.
 *
 * Deliberately a minimal top bar, not a full sidebar/dashboard shell —
 * that's STORY-039's scope (Admin Dashboard), not this story's.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const adminUser = await adminUserRepository.findById(session.user.id);
  if (!adminUser) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-cream">
      <header className="flex items-center justify-between border-b border-input bg-background px-6 py-3">
        <span className="font-heading text-h4 text-charcoal">Oristor Admin</span>
        <div className="flex items-center gap-3 text-small text-charcoal/70">
          <span>
            {adminUser.name} · {adminUser.role.name}
          </span>
          <AdminSignOutButton />
        </div>
      </header>
      <main className="p-6">{children}</main>
    </div>
  );
}
