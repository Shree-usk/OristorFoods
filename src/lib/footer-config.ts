import { FacebookIcon, InstagramIcon, YoutubeIcon, type BrandIcon } from "@/components/storefront/layout/social-icons";

/**
 * Single source of truth for footer link columns, social links, and
 * contact info. STORY-052/053 (Admin Navigation & Menu Management, CMS
 * Workflow) will eventually make this CMS-editable — until then, this
 * file is the thing to edit to add/remove a footer link.
 */

export interface FooterLink {
  label: string;
  href: string;
}

export interface FooterColumn {
  heading: string;
  links: FooterLink[];
}

/** Exactly the four columns from this story's Acceptance Criteria, surfacing
 * IA-tree items (docs/blueprint.md Section 4) not present in the header nav. */
export const footerColumns: FooterColumn[] = [
  {
    heading: "Shop",
    links: [
      { label: "Products", href: "/products" },
      { label: "Categories", href: "/products#categories" },
      { label: "Best Sellers", href: "/products?collection=best-sellers" },
    ],
  },
  {
    heading: "Learn",
    links: [
      { label: "Recipes", href: "/recipes" },
      { label: "Food Academy", href: "/food-academy" },
      { label: "Blog", href: "/blog" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About Us", href: "/about" },
      { label: "Sustainability", href: "/sustainability" },
      { label: "Export", href: "/export" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Account",
    links: [
      { label: "Customer Portal", href: "/account" },
      { label: "Rewards Club", href: "/account/rewards" },
      { label: "Referral Programme", href: "/account/referrals" },
      { label: "Wishlist", href: "/account/wishlist" },
    ],
  },
];

export const legalLinks: FooterLink[] = [
  { label: "Privacy Policy", href: "/legal/privacy" },
  { label: "Terms of Service", href: "/legal/terms" },
];

export interface SocialLink {
  label: string;
  href: string;
  icon: BrandIcon;
}

/** Placeholder handles — swap for the real accounts before launch. */
export const socialLinks: SocialLink[] = [
  { label: "Facebook", href: "https://facebook.com/oriatorfoods", icon: FacebookIcon },
  { label: "Instagram", href: "https://instagram.com/the.oristor", icon: InstagramIcon },
  { label: "YouTube", href: "https://youtube.com/@oristorfoods", icon: YoutubeIcon },
];

/**
 * Placeholder contact details — docs/blueprint.md doesn't specify the
 * real registered address/phone/email. Replace with real values before
 * production launch; System Settings (STORY-054) will eventually make
 * this admin-editable rather than hardcoded here.
 */
export const contactInfo = {
  companyName: "Oristor Food Products (Pvt) Ltd",
  address: "No 8, 8a, Hekitta Lane, Watta Sri Lanka",
  phone: "+94 11 222 84 85",
  email: "admin@oristor.com",
};
