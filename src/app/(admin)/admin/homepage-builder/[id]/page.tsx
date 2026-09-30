import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { HomepageBuilderCanvas } from "@/components/admin/homepage-builder/homepage-builder-canvas";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Layout | Homepage Builder | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminHomepageBuilderEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");
  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="HomepageBuilder" action="View">
      <HomepageBuilderCanvas layoutId={id} />
    </RequirePermission>
  );
}
