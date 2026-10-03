import type { LucideIcon } from "lucide-react";
import { ChefHat, Contact, Gift, Globe2, GraduationCap, Heart, Home, Info, Mail, Menu, Newspaper, Search, ShoppingBag, ShoppingCart, Sparkles, Tag, User } from "lucide-react";

/**
 * STORY-052. A curated name→component map, not a free string — a menu
 * item stores one of these keys (MenuItem.icon), never raw HTML or an
 * arbitrary executable value. Matches nav-config.ts's existing icon set
 * plus a few generic extras useful for admin-authored items.
 */
export const MENU_ICON_OPTIONS: Record<string, LucideIcon> = {
  Home,
  ShoppingBag,
  ChefHat,
  GraduationCap,
  Globe2,
  Newspaper,
  Info,
  Mail,
  Search,
  Heart,
  Gift,
  User,
  ShoppingCart,
  Menu,
  Contact,
  Tag,
  Sparkles,
};

export function resolveMenuIcon(name: string | null): LucideIcon | null {
  if (!name) return null;
  return MENU_ICON_OPTIONS[name] ?? null;
}
