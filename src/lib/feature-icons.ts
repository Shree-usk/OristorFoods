import type { LucideIcon } from "lucide-react";
import { Award, CheckCircle2, Globe2, Heart, Leaf, ShieldCheck, Sparkles, Star, Truck, Users } from "lucide-react";

/**
 * Homepage/Header redesign follow-up. A curated name->component map, same
 * "stored string, never a component reference" contract menu-icons.ts
 * uses — a HomepageSectionFeature stores one of these keys, resolved to
 * a component only by whichever Client/Server Component actually renders
 * it. Leaf/ShieldCheck/Users/Award match the 4 current approved benefit
 * icons exactly (home-fixtures.ts's whyChooseFeatures); the rest are
 * generic extras an admin might reach for on a new or edited item.
 */
export const FEATURE_ICON_OPTIONS: Record<string, LucideIcon> = {
  Leaf,
  ShieldCheck,
  Users,
  Award,
  Heart,
  Star,
  Truck,
  Globe2,
  Sparkles,
  CheckCircle2,
};

export function resolveFeatureIcon(name: string): LucideIcon | null {
  return FEATURE_ICON_OPTIONS[name] ?? null;
}
