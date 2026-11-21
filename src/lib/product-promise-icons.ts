import type { LucideIcon } from "lucide-react";
import { Ban, Droplet, FlaskConical, Leaf, Package, ShieldCheck, Sparkles, Sprout, Thermometer, Timer } from "lucide-react";

/**
 * PDP "Good Food. Thoughtfully Made." promise cards. Same "stored string,
 * never a component reference" contract as export-icons.ts/menu-icons.ts —
 * ProductPromiseAttribute.icon stores one of these keys, resolved only by
 * whichever component actually renders it.
 */
export const PRODUCT_PROMISE_ICON_OPTIONS: Record<string, LucideIcon> = {
  Ban,
  FlaskConical,
  Droplet,
  Leaf,
  Sprout,
  ShieldCheck,
  Sparkles,
  Package,
  Thermometer,
  Timer,
};

export function resolveProductPromiseIcon(name: string): LucideIcon | null {
  return PRODUCT_PROMISE_ICON_OPTIONS[name] ?? null;
}
