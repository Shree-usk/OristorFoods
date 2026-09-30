import type { AdminAction, AdminModule } from "@/generated/prisma/client";
import { AccessDenied } from "@/components/admin/access-denied";
import { hasPermission } from "@/services/permission.service";

/**
 * STORY-038. A UI convenience for future admin-module pages (STORY-039+)
 * — NOT the security boundary itself. The real enforcement is
 * permission.service.ts::requirePermission, called server-side by the
 * Service/route handler backing whatever action this wraps; hiding
 * content here only improves the UX of an already-denied request, per
 * the AC ("hiding a UI button is never treated as access control").
 */
export async function RequirePermission({
  adminUserId,
  module,
  action,
  children,
}: {
  adminUserId: string;
  module: AdminModule;
  action: AdminAction;
  children: React.ReactNode;
}) {
  const granted = await hasPermission(adminUserId, module, action);
  if (!granted) return <AccessDenied />;
  return <>{children}</>;
}
