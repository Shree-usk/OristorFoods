import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminBlogPostForm } from "@/components/admin/blog/admin-blog-post-form";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Edit Post | Admin",
  robots: { index: false, follow: false },
};

export default async function EditAdminBlogPostPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  const { id } = await params;

  return (
    <RequirePermission adminUserId={session.user.id} module="Blog" action="Edit">
      <AdminBlogPostForm postId={id} />
    </RequirePermission>
  );
}
