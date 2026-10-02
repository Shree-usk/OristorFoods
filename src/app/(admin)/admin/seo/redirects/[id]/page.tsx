import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminRedirectEditorView } from "@/components/admin/seo/admin-redirect-editor-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Redirect | Admin",
  robots: { index: false, follow: false },
};

export default async function EditAdminRedirectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="SEO" action="View">
      <AdminRedirectEditorView redirectId={id} />
    </RequirePermission>
  );
}
