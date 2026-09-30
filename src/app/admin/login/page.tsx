import type { Metadata } from "next";
import { Suspense } from "react";

import { AdminLoginForm } from "@/components/admin/admin-login-form";

export const metadata: Metadata = {
  title: "Admin Sign In",
  robots: { index: false, follow: false },
};

/**
 * STORY-038. Deliberately outside the (admin) route group/layout — that
 * layout is the protected shell (see src/app/(admin)/layout.tsx); login
 * itself must render without a session, the same way /account/login sits
 * outside the customer (dashboard) group.
 */
export default function AdminLoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4">
      <h1 className="text-h2 font-heading text-charcoal">Admin sign in</h1>
      {/* AdminLoginForm reads ?callbackUrl via useSearchParams — Next requires a Suspense boundary around that in prerendered builds. */}
      <Suspense>
        <AdminLoginForm />
      </Suspense>
    </div>
  );
}
