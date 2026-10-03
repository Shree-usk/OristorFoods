import type { Metadata } from "next";
import { Suspense } from "react";

import { AcceptInviteForm } from "@/components/admin/accept-invite-form";

export const metadata: Metadata = {
  title: "Accept Admin Invite",
  robots: { index: false, follow: false },
};

/**
 * STORY-057. Deliberately outside the (admin) route group/layout — that
 * layout (src/app/(admin)/layout.tsx) redirects to /admin/login for
 * anyone with no session, which an invited admin doesn't have yet, the
 * same reasoning /admin/login itself is already outside that group for.
 */
export default function AdminAcceptInvitePage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-h2 font-heading text-charcoal">Join the Oristor Admin Console</h1>
      {/* AcceptInviteForm reads ?token/?email via useSearchParams — Next requires a Suspense boundary around that in prerendered builds. */}
      <Suspense>
        <AcceptInviteForm />
      </Suspense>
    </div>
  );
}
