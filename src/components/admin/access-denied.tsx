/** STORY-038. Rendered when a signed-in admin lacks permission for a page's module/action — the redirect/render decision itself is not the security boundary, permission.service.ts::requirePermission already ran server-side before this could be reached. */
export function AccessDenied() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-h3 font-heading text-charcoal">Access denied</h1>
      <p className="mt-2 text-body text-charcoal/70">You do not have permission to view this page. Contact a Super Administrator if you believe this is a mistake.</p>
    </div>
  );
}
