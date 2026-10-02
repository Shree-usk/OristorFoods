import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLandingPageEditorView } from "@/components/admin/marketing/admin-landing-page-editor-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "New Landing Page | Admin",
  robots: { index: false, follow: false },
};

export default async function NewAdminLandingPagePage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="Edit">
      <AdminLandingPageEditorView landingPageId={null} />
    </RequirePermission>
  );
}
