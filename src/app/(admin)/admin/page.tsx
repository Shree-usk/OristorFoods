import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

/**
 * STORY-038. A minimal landing page proving the auth/RBAC foundation
 * works end to end — the live dashboard with widgets/modules is
 * STORY-039's scope, not this story's. (admin)/layout.tsx above already
 * guarantees a resolved session before this renders.
 */
export default function AdminHomePage() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Welcome to the Oristor admin console</h1>
      <p className="mt-2 text-body text-charcoal/70">The full dashboard and console modules are built in later stories.</p>
    </div>
  );
}
