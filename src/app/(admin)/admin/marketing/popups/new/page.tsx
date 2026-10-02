import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminPopupEditorView } from "@/components/admin/marketing/admin-popup-editor-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "New Pop-up | Admin",
  robots: { index: false, follow: false },
};

export default async function NewAdminPopupPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Marketing" action="Edit">
      <AdminPopupEditorView popupId={null} />
    </RequirePermission>
  );
}
