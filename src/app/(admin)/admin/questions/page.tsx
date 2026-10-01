import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AdminQaQueueView } from "@/components/admin/qa/admin-qa-queue-view";
import { RequirePermission } from "@/components/admin/require-permission";
import { adminAuth } from "@/lib/admin-auth";

export const metadata: Metadata = {
  title: "Q&A | Admin",
  robots: { index: false, follow: false },
};

/** STORY-046. Product Q&A moderation (STORY-016). Recipe Q&A doesn't exist as a distinct feature — see docs/architecture-decisions.md. */
export default async function AdminQuestionsPage() {
  const session = await adminAuth();
  if (!session?.user?.id) redirect("/admin/login");

  return (
    <RequirePermission adminUserId={session.user.id} module="QA" action="View">
      <AdminQaQueueView />
    </RequirePermission>
  );
}
