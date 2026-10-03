import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminDeliveryZoneForm } from "@/components/admin/delivery-zones/admin-delivery-zone-form";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "New Delivery Zone | Admin",
  robots: { index: false, follow: false },
};

export default async function NewAdminDeliveryZonePage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="DeliveryZones" action="Edit">
      <AdminDeliveryZoneForm zoneId={null} />
    </RequirePermission>
  );
}
