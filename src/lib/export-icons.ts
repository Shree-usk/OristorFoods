import type { LucideIcon } from "lucide-react";
import { Factory, FileText, FlaskConical, Globe2, Package, Receipt, Tag, Truck } from "lucide-react";

/**
 * /export page revamp. A curated name->component map, same "stored
 * string, never a component reference" contract menu-icons.ts /
 * feature-icons.ts already use — both ExportSolutionCard and
 * ExportProcessStep store one of these keys, resolved to a component
 * only by whichever component actually renders it.
 */
export const EXPORT_ICON_OPTIONS: Record<string, LucideIcon> = {
  Package,
  Tag,
  Globe2,
  FileText,
  FlaskConical,
  Receipt,
  Factory,
  Truck,
};

export function resolveExportIcon(name: string): LucideIcon | null {
  return EXPORT_ICON_OPTIONS[name] ?? null;
}
