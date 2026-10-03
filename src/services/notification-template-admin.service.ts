import * as notificationRepository from "@/repositories/notification.repository";
import { renderTemplate } from "@/services/notification.service";
import { requirePermission } from "@/services/permission.service";
import { writeAuditLog } from "@/services/audit-log.service";
import { NotificationTemplateNotFoundError } from "@/services/notification-template-admin.errors";

/**
 * STORY-054. The admin authoring surface over NotificationTemplate —
 * the model, seed data, and merge-field render engine
 * (notification.service.ts::renderTemplate) all already existed from
 * STORY-032, which deliberately deferred "the authoring UI" to this
 * story. Distinct from notification.service.ts's own sending pipeline.
 */

export async function listTemplatesForAdmin(adminUserId: string) {
  await requirePermission(adminUserId, "SystemSettings", "View");
  return notificationRepository.listTemplates();
}

export interface UpdateTemplateInput {
  subject?: string | null;
  body?: string;
  isActive?: boolean;
}

export async function updateTemplate(adminUserId: string, id: string, input: UpdateTemplateInput) {
  await requirePermission(adminUserId, "SystemSettings", "Edit");
  const existing = await notificationRepository.findTemplateById(id);
  if (!existing) throw new NotificationTemplateNotFoundError();

  const updated = await notificationRepository.updateTemplate(id, input);
  await writeAuditLog({ actorId: adminUserId, action: "notification_template_updated", module: "SystemSettings", targetType: "NotificationTemplate", targetId: id });
  return updated;
}

/** Pure — reuses renderTemplate exactly as the real sending path does, just fed admin-typed sample values instead of real order/customer data. */
export function previewTemplate(body: string, sampleVariables: Record<string, string>): string {
  return renderTemplate(body, sampleVariables);
}

/** The {{variableName}} placeholders found in a template's body, for the admin UI's sample-value editor. */
export function extractMergeFields(body: string): string[] {
  const matches = body.matchAll(/\{\{(\w+)\}\}/g);
  return [...new Set([...matches].map((match) => match[1]!))];
}
