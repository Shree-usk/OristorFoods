import { Award, Leaf, ShieldCheck, Users } from "lucide-react";

import type {
  CategoryCardData,
  CollectionCardData,
  HeroBannerData,
  InstagramPostData,
  ProductCardData,
  RecipeCardData,
  ReviewData,
  TeaserSectionData,
  WhyChooseFeatureData,
} from "@/types/home";

/**
 * TEMPORARY fixture data for the homepage (STORY-006). Real product
 * photography (`public/images/products/**`) is used where available so
 * the page doesn't look like a wireframe, but the surrounding copy,
 * prices, ratings, and recipe/review content are placeholder — none of
 * this is wired to a real database yet.
 *
 * Replace the *source* of each export below with a real query once the
 * corresponding epic lands (see the Dependencies list in
 * docs/stories/02-core-ui/STORY-006-homepage.md); the section components
 * that consume these only care about the `src/types/home.ts` shapes, not
 * where the data comes from.
 */

export const heroBanner: HeroBannerData = {
  headline: "Feel the Difference",
  subheadline:
    "Authentic Sri Lankan flavors, crafted the traditional way and brought to your table with premium quality you can trust.",
  ctaLabel: "Shop Best Sellers",
  ctaHref: "/products?collection=best-sellers",
  imageSrc: "/images/products/misc/Bottles-group.webp",
  imageAlt: "A curated group of Oristor jars and bottles",
};

export const featuredCategories: CategoryCardData[] = [
  {
    id: "chili-pastes",
    name: "Chili Pastes & Sambols",
    href: "/products?category=chili-pastes",
    imageSrc: "/images/products/misc/Chili-Paste-Large.webp",
    imageAlt: "Jar of Oristor stemless chili paste",
  },
  {
    id: "pickles",
    name: "Traditional Pickles",
    href: "/products?category=pickles",
    imageSrc: "/images/products/misc/Sinhala%20Achcharu.webp",
    imageAlt: "Jar of traditional Sinhala achcharu pickle",
  },
  {
    id: "spice-powders",
    name: "Spice Powders",
    href: "/products?category=spice-powders",
    imageSrc: "/images/products/export/curry-powder.webp",
    imageAlt: "Pack of Oristor curry powder",
  },
  {
    id: "gift-packs",
    name: "Gift Packs",
    href: "/products?collection=gift-packs",
    imageSrc: "/images/products/gifts/Gift-1.webp",
    imageAlt: "Oristor gift box with two jars",
  },
  {
    id: "brined-vegetables",
    name: "Brined Vegetables",
    href: "/products?category=brined-vegetables",
    imageSrc: "/images/products/export/oristor-brine-in-Jackfruit-1.webp",
    imageAlt: "Jar of Oristor brined young jackfruit",
  },
  {
    id: "masala-blends",
    name: "Masala Blends",
    href: "/products?category=masala-blends",
    imageSrc: "/images/products/misc/Masala.webp",
    imageAlt: "Pack of Oristor masala blend",
  },
];

export const whyChooseFeatures: WhyChooseFeatureData[] = [
  {
    id: "authentic",
    icon: Leaf,
    title: "Authentic Sri Lankan Recipes",
    description: "Made the traditional way, passed down through generations of Sri Lankan kitchens.",
  },
  {
    id: "quality",
    icon: ShieldCheck,
    title: "Premium Quality, Verified",
    description: "Every batch is quality-checked so what you taste is always what you expect.",
  },
  {
    id: "trusted",
    icon: Users,
    title: "Trusted by Thousands",
    description: "A loyal community of home cooks and the Sri Lankan diaspora across the world.",
  },
  {
    id: "sourcing",
    icon: Award,
    title: "Sustainably Sourced",
    description: "Ingredients sourced responsibly from Sri Lankan farms and producers.",
  },
];

export const bestSellingProducts: ProductCardData[] = [
  {
    id: "chili-paste-stemless",
    name: "Stemless Chili Paste",
    href: "/products/chili-paste-stemless",
    imageSrc: "/images/products/best-sellers/Chili-Paste-Large.png",
    imageAlt: "Jar of Oristor stemless chili paste",
    price: 850,
    currency: "LKR",
    rating: 4.8,
    reviewCount: 214,
    badge: "Best Seller",
  },
  {
    id: "koonisso",
    name: "Koonisso (Dried Shrimp Sambol)",
    href: "/products/koonisso",
    imageSrc: "/images/products/best-sellers/Koonisso-Large.webp",
    imageAlt: "Jar of Oristor koonisso dried shrimp sambol",
    price: 620,
    currency: "LKR",
    rating: 4.7,
    reviewCount: 156,
  },
  {
    id: "maldives-fish",
    name: "Maldives Fish Flakes",
    href: "/products/maldives-fish",
    imageSrc: "/images/products/best-sellers/Maldives-Large.webp",
    imageAlt: "Jar of Oristor Maldives fish flakes",
    price: 950,
    currency: "LKR",
    rating: 4.9,
    reviewCount: 98,
    badge: "Best Seller",
  },
  {
    id: "mango-pickle",
    name: "Mango Pickle",
    href: "/products/mango-pickle",
    imageSrc: "/images/products/best-sellers/Mango-Pickle-Large.webp",
    imageAlt: "Jar of Oristor mango pickle",
    price: 480,
    currency: "LKR",
    rating: 4.6,
    reviewCount: 132,
  },
  {
    id: "sprats",
    name: "Crispy Sprats",
    href: "/products/sprats",
    imageSrc: "/images/products/best-sellers/Sprats-Large.webp",
    imageAlt: "Pack of Oristor crispy sprats",
    price: 390,
    currency: "LKR",
    rating: 4.5,
    reviewCount: 87,
  },
];

export const featuredRecipes: RecipeCardData[] = [
  {
    id: "deviled-prawns",
    title: "Chili Paste Deviled Prawns",
    href: "/recipes/chili-paste-deviled-prawns",
    imageSrc: "/images/products/best-sellers/Chili-Paste-Large.png",
    imageAlt: "Oristor stemless chili paste, used in this recipe",
    cookTimeMinutes: 25,
    difficulty: "Easy",
  },
  {
    id: "mango-pickle-rice",
    title: "Spiced Mango Pickle Rice",
    href: "/recipes/spiced-mango-pickle-rice",
    imageSrc: "/images/products/best-sellers/Mango-Pickle-Large.webp",
    imageAlt: "Oristor mango pickle, used in this recipe",
    cookTimeMinutes: 35,
    difficulty: "Medium",
  },
  {
    id: "coconut-sambol",
    title: "Coconut Sambol with Maldive Fish",
    href: "/recipes/coconut-sambol-maldive-fish",
    imageSrc: "/images/products/best-sellers/Maldives-Large.webp",
    imageAlt: "Oristor Maldives fish flakes, used in this recipe",
    cookTimeMinutes: 15,
    difficulty: "Easy",
  },
];

export const productCollections: CollectionCardData[] = [
  {
    id: "festive-gift-collection",
    name: "Festive Gift Collection",
    href: "/products?collection=festive-gifts",
    imageSrc: "/images/products/gifts/GiftCard.webp",
    imageAlt: "Oristor festive gift box",
    description: "Beautifully packaged sets, ready to gift.",
  },
  {
    id: "export-signature-range",
    name: "Export Signature Range",
    href: "/products?collection=export-signature",
    imageSrc: "/images/products/export/KithulBottle2.png",
    imageAlt: "Oristor export signature Kithul bottle",
    description: "Our premium line, trusted by distributors worldwide.",
  },
  {
    id: "home-cook-essentials",
    name: "Home Cook Essentials",
    href: "/products?collection=home-cook-essentials",
    imageSrc: "/images/products/misc/Vegetable-Large.webp",
    imageAlt: "Oristor home cook essentials jar",
    description: "Everyday staples for the Sri Lankan kitchen.",
  },
];

/**
 * Text-only testimonials — no photos. Fabricating stock customer headshots
 * would misrepresent real people; swap for STORY-015's real submitted
 * reviews (which may include a customer-uploaded avatar) instead of
 * sourcing fake portraits for this fixture.
 */
export const customerReviews: ReviewData[] = [
  {
    id: "review-1",
    authorName: "Priyanka W.",
    authorLocation: "Colombo, Sri Lanka",
    rating: 5,
    quote:
      "Tastes exactly like my grandmother's chili paste. I've stopped making my own and just buy Oristor now.",
  },
  {
    id: "review-2",
    authorName: "Dinesh R.",
    authorLocation: "Toronto, Canada",
    rating: 5,
    quote: "As a Sri Lankan living abroad, this is the closest I've found to home. The Maldive fish is incredible.",
  },
  {
    id: "review-3",
    authorName: "Amara S.",
    authorLocation: "London, UK",
    rating: 4,
    quote: "Great quality and the gift box made a wonderful present for my in-laws.",
  },
];

export const foodAcademyTeaser: TeaserSectionData = {
  eyebrow: "Food Academy",
  headline: "Learn to Cook Sri Lankan the Authentic Way",
  description:
    "Guides, techniques, and ingredient deep-dives from Oristor's kitchen — start with the basics or go deep on regional specialties.",
  ctaLabel: "Explore Food Academy",
  ctaHref: "/food-academy",
  imageSrc: "/images/products/export/turmeric-powder.webp",
  imageAlt: "Oristor turmeric powder",
};

export const exportSolutions: TeaserSectionData = {
  eyebrow: "Export Solutions",
  headline: "Partner with Oristor for Global Distribution",
  description:
    "From single-origin sourcing to bulk export packaging, we work with distributors, importers, and retailers worldwide.",
  ctaLabel: "Explore Export Solutions",
  ctaHref: "/export",
  imageSrc: "/images/products/export/Kithul-Jaggery-500g.png",
  imageAlt: "Oristor Kithul jaggery export packaging",
};

export const rewardsClubTeaser: TeaserSectionData = {
  eyebrow: "Rewards Club",
  headline: "Earn Points on Every Order",
  description:
    "Join the Oristor Rewards Club to earn points on every purchase, unlock member-only offers, and redeem rewards.",
  ctaLabel: "Join Rewards Club",
  ctaHref: "/account/rewards",
  imageSrc: "/images/products/gifts/Gift4.webp",
  imageAlt: "Oristor gift box",
};

export const instagramPosts: InstagramPostData[] = [
  {
    id: "ig-1",
    imageSrc: "/images/products/misc/Kalukudu.webp",
    imageAlt: "Oristor Kalukudu product shot",
    href: "https://instagram.com/oristorfoods",
  },
  {
    id: "ig-2",
    imageSrc: "/images/products/export/chili-piece.webp",
    imageAlt: "Oristor chili pieces product shot",
    href: "https://instagram.com/oristorfoods",
  },
  {
    id: "ig-3",
    imageSrc: "/images/products/export/oristor-brine-in-Lotus-blossom.webp",
    imageAlt: "Oristor brined lotus blossom product shot",
    href: "https://instagram.com/oristorfoods",
  },
  {
    id: "ig-4",
    imageSrc: "/images/products/gifts/Image-9.webp",
    imageAlt: "Oristor gift product shot",
    href: "https://instagram.com/oristorfoods",
  },
  {
    id: "ig-5",
    imageSrc: "/images/products/gifts/Image-10.webp",
    imageAlt: "Oristor gift product shot",
    href: "https://instagram.com/oristorfoods",
  },
  {
    id: "ig-6",
    imageSrc: "/images/products/export/pepper.webp",
    imageAlt: "Oristor pepper product shot",
    href: "https://instagram.com/oristorfoods",
  },
];
