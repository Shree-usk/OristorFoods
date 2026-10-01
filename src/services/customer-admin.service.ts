import type { CustomerGroup } from "@/generated/prisma/client";
import * as userRepository from "@/repositories/user.repository";
import { writeAuditLog } from "@/services/audit-log.service";
import { CustomerNotFoundError } from "@/services/customer-admin.errors";
import { requirePermission } from "@/services/permission.service";

/**
 * STORY-071. The minimal admin path for setting a customer's pricing
 * group, so STORY-048 (Admin Customers Console) has a real field to
 * build its UI on top of when it's reached in build order. Mirrors
 * product-admin.service.ts::setCustomerGroupPrice's permission/audit-log
 * shape exactly. Deliberately the only admin-customer capability this
 * story ships — see the story doc's "Out of Scope."
 */
export async function setCustomerGroup(adminUserId: string, customerId: string, group: CustomerGroup) {
  await requirePermission(adminUserId, "Customers", "Edit");

  const customer = await userRepository.findById(customerId);
  if (!customer) throw new CustomerNotFoundError();

  const updated = await userRepository.updateCustomerGroup(customerId, group);
  await writeAuditLog({
    actorId: adminUserId,
    action: "customer_group_set",
    module: "Customers",
    targetType: "User",
    targetId: customerId,
    metadata: { from: customer.customerGroup, to: group },
  });
  return updated;
}
