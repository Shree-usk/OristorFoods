import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminBlogCommentsView } from "@/components/admin/blog/admin-blog-comments-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Blog Comments | Admin",
  robots: { index: false, follow: false },
};

export default async function AdminBlogCommentsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="Blog" action="View">
      <AdminBlogCommentsView />
    </RequirePermission>
  );
}
