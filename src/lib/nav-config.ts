/**
 * Single source of truth for site navigation, per docs/blueprint.md
 * Section 4. Desktop and mobile nav components both read from here —
 * never hardcode a separate link array. STORY-052 (Admin Navigation &
 * Menu Management) made this data-driven from the CMS for Header/Mobile
 * (not this action cluster) — see navigation.service.ts.
 */

export interface NavItem {
  label: string;
  href: string;
  // A name key into src/lib/menu-icons.ts's MENU_ICON_OPTIONS, resolved
  // to a component at render time by whichever Client Component
  // actually renders it (mobile-nav.tsx, mobile-drawer-links-list.tsx —
  // desktop NavLinks never renders this field at all). Deliberately a
  // string, not a LucideIcon component reference: this array can be
  // produced server-side (navigation.service.ts, from a published DB
  // menu) and passed as a prop into a Client Component, and a function/
  // component reference can't cross that serialization boundary.
  icon?: string;
  /** Renders a mega-menu flyout on desktop hover/click (Products, Recipes). */
  megaMenu?: MegaMenuSection[];
}

export interface MegaMenuPromoTile {
  imageUrl: string;
  imageAlt: string;
  heading: string;
  ctaLabel: string;
  ctaHref: string;
}

export interface MegaMenuSection {
  heading: string;
  links: { label: string; href: string }[];
  /** STORY-052. A rich content block alongside the plain link list — e.g. a featured image/promo tile, not just flat links. */
  promoTile?: MegaMenuPromoTile;
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
  { label: "Home", href: "/", icon: "Home" },
  { label: "Products", href: "/products", icon: "ShoppingBag", megaMenu: productsMegaMenu },
  { label: "Recipes", href: "/recipes", icon: "ChefHat", megaMenu: recipesMegaMenu },
  { label: "Food Academy", href: "/food-academy", icon: "GraduationCap" },
  { label: "Export", href: "/export", icon: "Globe2" },
  { label: "Blog", href: "/blog", icon: "Newspaper" },
  { label: "About", href: "/about", icon: "Info" },
  { label: "Contact", href: "/contact", icon: "Mail" },
];

/** Right-aligned desktop action cluster, in blueprint Section 4 order. */
export const actionNavItems: NavItem[] = [
  { label: "Search", href: "/search", icon: "Search" },
  { label: "Wishlist", href: "/account/wishlist", icon: "Heart" },
  { label: "Rewards", href: "/account/rewards", icon: "Gift" },
  { label: "Account", href: "/account", icon: "User" },
  { label: "Cart", href: "/cart", icon: "ShoppingCart" },
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
  { label: "Menu", href: "#menu", icon: "Menu" },
  actionNavItems[4], // Cart
];

/** Links shown in the mobile "Menu" drawer — the desktop-only items. */
export const mobileDrawerItems: NavItem[] = primaryNavItems.filter((item) =>
  ["Food Academy", "Export", "Blog", "About", "Contact"].includes(item.label),
);
