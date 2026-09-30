import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { MediaLibraryView } from "@/components/admin/media/media-library-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Media Library | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminMediaLibraryPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="MediaLibrary" action="View">
      <MediaLibraryView />
    </RequirePermission>
  );
}
