import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PreviewWidthToggle } from "@/components/admin/homepage-builder/preview-width-toggle";
import { Button } from "@/components/ui/button";
import { HomepageSections } from "@/components/storefront/home/homepage-sections";
import { adminAuth } from "@/lib/admin-auth";
import { hasPermission } from "@/services/permission.service";
import { getLayout } from "@/services/homepage-builder.service";
import { HomepageLayoutNotFoundError } from "@/services/homepage-builder.errors";

export const metadata: Metadata = {
  title: "Preview | Homepage Builder | Admin",
  robots: { index: false, follow: false },
};

/**
 * Core-scope "preview" per the user's scope decision: server-renders the
 * real storefront section components against this layout's saved data
 * (not unsaved form edits) — an admin-only route, not the live storefront.
 */
export default async function AdminHomepageBuilderPreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");
  if (!(await hasPermission(session.user.id, "HomepageBuilder", "View"))) redirect("/admin");

  const { id } = await params;
  let layout;
  try {
    layout = await getLayout(session.user.id, id);
  } catch (error) {
    if (error instanceof HomepageLayoutNotFoundError) notFound();
    throw error;
  }

  return (
    <div>
      <div className="flex items-center justify-between border-b border-border bg-beige px-4 py-3">
        <p className="text-small text-charcoal">Previewing layout ({layout.status}) — not the live storefront.</p>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/homepage-builder/${id}`} />}>
          Back to editor
        </Button>
      </div>
      <PreviewWidthToggle>
        <HomepageSections layout={layout} />
      </PreviewWidthToggle>
    </div>
  );
}
