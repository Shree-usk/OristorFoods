import type { LucideIcon } from "lucide-react";
import {
  ChefHat,
  GraduationCap,
  Globe2,
  Newspaper,
  Info,
  Mail,
  Home,
  ShoppingBag,
  Search,
  Heart,
  Gift,
  User,
  ShoppingCart,
  Menu,
} from "lucide-react";

/**
 * Single source of truth for site navigation, per docs/blueprint.md
 * Section 4. Desktop and mobile nav components both read from here —
 * never hardcode a separate link array. STORY-052 (Admin Navigation &
 * Menu Management) will eventually make this data-driven from the CMS;
 * until then, this file is the thing to edit to add/remove a nav item.
 */

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Renders a mega-menu flyout on desktop hover/click (Products, Recipes). */
  megaMenu?: MegaMenuSection[];
}

export interface MegaMenuSection {
  heading: string;
  links: { label: string; href: string }[];
}

/**
 * Placeholder category shortcuts — real data comes from the Product
 * Platform (STORY-009/010) and Recipes (STORY-017) epics. Replace these
 * static arrays once those catalogues exist; don't hand-roll a second
 * mega-menu data source when that happens, extend this file instead.
 */
const productsMegaMenu: MegaMenuSection[] = [
  {
    heading: "Shop",
    links: [
      { label: "All Products", href: "/products" },
      { label: "Best Sellers", href: "/products?collection=best-sellers" },
      { label: "Gift Packs", href: "/products?collection=gift-packs" },
      { label: "Export Range", href: "/products?collection=export" },
    ],
  },
];

const recipesMegaMenu: MegaMenuSection[] = [
  {
    heading: "Explore",
    links: [
      { label: "All Recipes", href: "/recipes" },
      { label: "Quick & Easy", href: "/recipes?difficulty=easy&time=under-15,15-30" },
      { label: "Video Recipes", href: "/recipes?hasVideo=true" },
      { label: "Cooking Tips", href: "/recipes/cooking-tips" },
      { label: "Food Academy", href: "/food-academy" },
    ],
  },
];

/** Full desktop primary nav, in blueprint Section 4 order. */
export const primaryNavItems: NavItem[] = [
  { label: "Home", href: "/", icon: Home },
  { label: "Products", href: "/products", icon: ShoppingBag, megaMenu: productsMegaMenu },
  { label: "Recipes", href: "/recipes", icon: ChefHat, megaMenu: recipesMegaMenu },
  { label: "Food Academy", href: "/food-academy", icon: GraduationCap },
  { label: "Export", href: "/export", icon: Globe2 },
  { label: "Blog", href: "/blog", icon: Newspaper },
  { label: "About", href: "/about", icon: Info },
  { label: "Contact", href: "/contact", icon: Mail },
];

/** Right-aligned desktop action cluster, in blueprint Section 4 order. */
export const actionNavItems: NavItem[] = [
  { label: "Search", href: "/search", icon: Search },
  { label: "Wishlist", href: "/account/wishlist", icon: Heart },
  { label: "Rewards", href: "/account/rewards", icon: Gift },
  { label: "Account", href: "/account", icon: User },
  { label: "Cart", href: "/cart", icon: ShoppingCart },
];

/**
 * Reduced mobile nav — blueprint Section 4's mobile list exactly:
 * Home, Products, Recipes, Search, Rewards, Account, Menu, Cart.
 * "Menu" isn't a route — it opens the off-canvas drawer with the
 * desktop-only links (Food Academy, Export, Blog, About, Contact).
 */
export const mobileNavItems: NavItem[] = [
  primaryNavItems[0], // Home
  primaryNavItems[1], // Products
  primaryNavItems[2], // Recipes
  actionNavItems[0], // Search
  actionNavItems[2], // Rewards
  actionNavItems[3], // Account
  { label: "Menu", href: "#menu", icon: Menu },
  actionNavItems[4], // Cart
];

/** Links shown in the mobile "Menu" drawer — the desktop-only items. */
export const mobileDrawerItems: NavItem[] = primaryNavItems.filter((item) =>
  ["Food Academy", "Export", "Blog", "About", "Contact"].includes(item.label),
);
