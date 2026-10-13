import type { AdminAction, AdminModule } from "@/generated/prisma/client";

export interface AdminNavLink {
  label: string;
  href: string;
  module: AdminModule;
  action: AdminAction;
}

export interface AdminNavGroup {
  title: string;
  links: AdminNavLink[];
}

/**
 * "Start a new one" shortcuts — only for routes that have a real `/new`
 * page on disk (confirmed by reading the route tree, not guessed from
 * naming).
 */
export const ADMIN_QUICK_ADD_LINKS: AdminNavLink[] = [
  { label: "Product", href: "/admin/products/new", module: "Products", action: "Edit" },
  { label: "Recipe", href: "/admin/recipes/new", module: "Recipes", action: "Edit" },
  { label: "Blog post", href: "/admin/blog/posts/new", module: "Blog", action: "Edit" },
  { label: "Landing page", href: "/admin/marketing/landing-pages/new", module: "Marketing", action: "Edit" },
  { label: "Popup", href: "/admin/marketing/popups/new", module: "Marketing", action: "Edit" },
  { label: "Seasonal campaign", href: "/admin/marketing/seasonal-campaigns/new", module: "Marketing", action: "Edit" },
  { label: "Delivery zone", href: "/admin/delivery-zones/new", module: "DeliveryZones", action: "Edit" },
  { label: "CRM segment", href: "/admin/crm/new", module: "CRMAnalytics", action: "Edit" },
];

/**
 * Every real admin route this console has, grouped the way an admin
 * reaches for them rather than by how the URLs happen to be nested.
 * Each link's {module, action} is the exact pair its own Service enforces
 * server-side (requirePermission) — read from the Service source, not
 * guessed from the route name, so this never offers a link that 404s or
 * promises access a role doesn't actually have.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    title: "Content",
    links: [
      { label: "Products", href: "/admin/products", module: "Products", action: "View" },
      { label: "Categories", href: "/admin/categories", module: "Products", action: "View" },
      { label: "Collections", href: "/admin/collections", module: "Products", action: "View" },
      { label: "Packaging methods", href: "/admin/packaging-methods", module: "Products", action: "View" },
      { label: "Certifications & allergens", href: "/admin/certifications", module: "Products", action: "View" },
      { label: "Search glossary", href: "/admin/search-glossary", module: "Products", action: "View" },
      { label: "Recipes", href: "/admin/recipes", module: "Recipes", action: "View" },
      { label: "Blog posts", href: "/admin/blog/posts", module: "Blog", action: "View" },
      { label: "Blog comments", href: "/admin/blog/comments", module: "Blog", action: "View" },
      { label: "Media library", href: "/admin/media", module: "MediaLibrary", action: "View" },
      { label: "Homepage builder", href: "/admin/homepage-builder", module: "HomepageBuilder", action: "View" },
      { label: "Story pages (About/Contact)", href: "/admin/story-pages", module: "StoryPages", action: "View" },
      { label: "Navigation & menus", href: "/admin/navigation", module: "Navigation", action: "View" },
      { label: "SEO", href: "/admin/seo", module: "SEO", action: "View" },
      { label: "Redirects", href: "/admin/seo/redirects", module: "SEO", action: "View" },
    ],
  },
  {
    title: "Commerce",
    links: [
      { label: "Orders", href: "/admin/orders", module: "Orders", action: "View" },
      { label: "Customers", href: "/admin/customers", module: "Customers", action: "View" },
      { label: "Coupons", href: "/admin/marketing/coupons", module: "Marketing", action: "View" },
      { label: "Delivery zones", href: "/admin/delivery-zones", module: "DeliveryZones", action: "View" },
      { label: "Rewards & referrals", href: "/admin/rewards-referrals", module: "RewardsReferrals", action: "View" },
      { label: "Export portal", href: "/admin/export", module: "ExportPortal", action: "View" },
      { label: "Export distributor accounts", href: "/admin/export/distributor-accounts", module: "ExportPortal", action: "View" },
    ],
  },
  {
    title: "Marketing",
    links: [
      { label: "Email / SMS campaigns", href: "/admin/marketing/email-sms", module: "Marketing", action: "View" },
      { label: "Popups", href: "/admin/marketing/popups", module: "Marketing", action: "View" },
      { label: "Seasonal campaigns", href: "/admin/marketing/seasonal-campaigns", module: "Marketing", action: "View" },
      { label: "Landing pages", href: "/admin/marketing/landing-pages", module: "Marketing", action: "View" },
    ],
  },
  {
    title: "Moderation",
    links: [
      { label: "Reviews", href: "/admin/reviews", module: "Reviews", action: "View" },
      { label: "Product Q&A", href: "/admin/questions", module: "QA", action: "View" },
      { label: "Recipe Q&A", href: "/admin/recipe-questions", module: "QA", action: "View" },
      { label: "Contact enquiries", href: "/admin/contact-enquiries", module: "ContactEnquiries", action: "View" },
      { label: "My review queue", href: "/admin/cms/my-queue", module: "CMSWorkflow", action: "View" },
    ],
  },
  {
    title: "Analytics & reports",
    links: [
      { label: "Analytics", href: "/admin/analytics", module: "CRMAnalytics", action: "View" },
      { label: "Executive dashboard", href: "/admin/executive-dashboard", module: "CRMAnalytics", action: "View" },
      { label: "CRM segments", href: "/admin/crm", module: "CRMAnalytics", action: "View" },
    ],
  },
  {
    title: "System",
    links: [
      { label: "Users", href: "/admin/users", module: "UsersRolesAudit", action: "View" },
      { label: "Roles & permissions", href: "/admin/roles", module: "UsersRolesAudit", action: "View" },
      // Audit Logs' list route checks the Audit action specifically, not
      // View (see audit-log-admin.service.ts) — the one link in this
      // registry whose action differs from its module-mates.
      { label: "Audit logs", href: "/admin/audit-logs", module: "UsersRolesAudit", action: "Audit" },
      { label: "System health", href: "/admin/system-health", module: "UsersRolesAudit", action: "View" },
      { label: "Settings", href: "/admin/settings", module: "SystemSettings", action: "View" },
      { label: "ERP integration", href: "/admin/erp-integration", module: "ERPIntegration", action: "View" },
    ],
  },
];

function permissionKey(module: AdminModule, action: AdminAction): string {
  return `${module}:${action}`;
}

/**
 * Drops any link the given permission set doesn't actually grant, and
 * drops a group entirely once it has no links left — true server-side
 * omission rather than a client-side hide, same treatment
 * admin-dashboard.service.ts already gives an ungranted KPI widget.
 */
export function filterAdminNavByPermissions(
  permissions: Set<string>,
  quickAdd: AdminNavLink[],
  groups: AdminNavGroup[],
): { quickAdd: AdminNavLink[]; groups: AdminNavGroup[] } {
  const hasAccess = (link: AdminNavLink) => permissions.has(permissionKey(link.module, link.action));

  return {
    quickAdd: quickAdd.filter(hasAccess),
    groups: groups.map((group) => ({ ...group, links: group.links.filter(hasAccess) })).filter((group) => group.links.length > 0),
  };
}
