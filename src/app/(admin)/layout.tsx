/**
 * Admin console layout — diverges from the storefront layout so auth
 * rules (RBAC gate, STORY-038) and chrome (sidebar/topbar) can differ
 * without sharing a URL prefix.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
