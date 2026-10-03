import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminExportEnquiryDetailView } from "@/components/admin/export/admin-export-enquiry-detail-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Export Enquiry | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminExportEnquiryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="ExportPortal" action="View">
      <AdminExportEnquiryDetailView id={id} />
    </RequirePermission>
  );
}
