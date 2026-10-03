import type { CustomerGroup, MenuItemVisibility } from "@/generated/prisma/client";

/**
 * STORY-052. A scoped-down version of popup.service.ts's matchesAudience —
 * a nav item doesn't need loyalty/referral targeting, just these 3 cases.
 */
export interface MenuVisibilityContext {
  userId: string | null;
  customerGroup: CustomerGroup | null;
}

export function matchesMenuVisibility(item: { visibility: MenuItemVisibility; targetCustomerGroup: CustomerGroup | null }, context: MenuVisibilityContext): boolean {
  switch (item.visibility) {
    case "Always":
      return true;
    case "Authenticated":
      return context.userId !== null;
    case "CustomerGroupTarget":
      return context.userId !== null && item.targetCustomerGroup !== null && context.customerGroup === item.targetCustomerGroup;
    default:
      return false;
  }
}
