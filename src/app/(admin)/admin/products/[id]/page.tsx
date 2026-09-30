import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminProductForm } from "@/components/admin/products/admin-product-form";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Product | Admin",
  robots: { index: false, follow: false },
};

export default async function EditAdminProductPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="Products" action="Edit">
      <AdminProductForm productId={id} />
    </RequirePermission>
  );
}
