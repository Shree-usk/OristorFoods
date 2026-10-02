import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminLandingPageEditorView } from "@/components/admin/marketing/admin-landing-page-editor-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Landing Page | Admin",
  robots: { index: false, follow: false },
};

export default async function EditAdminLandingPagePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="View">
      <AdminLandingPageEditorView landingPageId={id} />
    </RequirePermission>
  );
}
