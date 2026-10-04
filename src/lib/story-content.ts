/**
 * STORY-073. Single source of truth for the "Our Story" page's copy and
 * real image paths — keeps every story component prop-driven, same
 * separation `footer-config.ts`/`nav-config.ts` already establish for
 * this codebase's other static content.
 *
 * Every image path below points at a real, already-uploaded Oristor
 * product photo under `public/images/products/` (the same files
 * `prisma/seed-recipes.ts` already reuses directly as static paths, not
 * `Product.images`-linked). No Sri Lanka/landscape imagery exists
 * anywhere in this project — per the user's own decision, the Hero and
 * "The Land" chapter use real ingredient/product close-ups instead of
 * landscape photography, never a stock/placeholder substitute.
 */

export interface StoryImage {
  src: string;
  alt: string;
}

export const heroContent = {
  eyebrow: "Our Story",
  headline: "A Taste of Sri Lanka, Crafted for the World.",
  subcopy:
    "Rooted in Sri Lanka's rich culinary traditions, ORISTOR brings authentic flavours, time-honoured recipes and carefully selected ingredients to kitchens around the world.",
  image: { src: "/images/products/export/curry-powder.webp", alt: "Real Oristor curry powder, close up" } satisfies StoryImage,
};

export interface StoryChapterContent {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: StoryImage;
  align: "left" | "right";
}

export const landChapter: StoryChapterContent = {
  id: "the-land",
  eyebrow: "Chapter 01",
  title: "Born from Sri Lanka",
  body: "Our story begins in Sri Lanka — an island where food is deeply connected to culture, family and tradition.",
  image: { src: "/images/products/export/turmeric-powder.webp", alt: "Real Oristor turmeric powder" },
  align: "left",
};

export const traditionChapter: StoryChapterContent = {
  id: "tradition-in-every-recipe",
  eyebrow: "Chapter 03",
  title: "Recipes With a Memory",
  body: "Some flavours are more than recipes. They are memories passed from one generation to another.",
  image: { src: "/images/products/best-sellers/Mango-Pickle-Large.webp", alt: "Real Oristor mango pickle" },
  align: "right",
};

export const companyChapter: StoryChapterContent = {
  id: "from-tradition-to-the-oristor",
  eyebrow: "Chapter 04",
  title: "From Our Kitchen to Yours",
  // Real, approved text from docs/blueprint.md Section 1 — not the
  // original brief's own paraphrase, which doesn't appear anywhere in
  // approved project content.
  body: "Our vision is to become the world's most trusted digital destination for authentic Sri Lankan food. Our mission is to enable Oristor to expand globally while preserving Sri Lankan food heritage — through premium products, authentic heritage, and a digital experience built to compete with the world's best food brands.",
  image: { src: "/images/products/best-sellers/Chili-Paste-Large.png", alt: "Real Oristor chilli paste" },
  align: "left",
};

export const qualityChapter: StoryChapterContent = {
  id: "quality-and-trust",
  eyebrow: "Craftsmanship",
  title: "From Ingredient to Finished Product",
  // No certification (ISO/HACCP/GMP) is claimed — none is verified
  // anywhere in this project's real data (a Certification model exists,
  // but zero rows are ever seeded). This stays a process narrative, not
  // a certification claim.
  body: "Every Oristor product follows the same path: real ingredients, careful preparation, and packaging built to protect the flavour inside — the same standard whether a jar is headed to a kitchen down the road or across the world.",
  image: { src: "/images/products/export/chili-powder.webp", alt: "Real Oristor chilli powder" },
  align: "right",
};

export interface IngredientContent {
  name: string;
  tagline: string;
  image: StoryImage;
}

export const flavoursChapter = {
  eyebrow: "Chapter 02",
  title: "The Flavours We Grew Up With",
  ingredients: [
    { name: "Chilli", tagline: "The heart of Sri Lankan heat.", image: { src: "/images/products/export/chili-piece.webp", alt: "Real Oristor chilli" } },
    { name: "Mango", tagline: "Sweet, sour and unmistakably Sri Lankan.", image: { src: "/images/products/best-sellers/Mango-Pickle-Large.webp", alt: "Real Oristor mango pickle" } },
    { name: "Spices", tagline: "The foundation of our flavour.", image: { src: "/images/products/export/pepper.webp", alt: "Real Oristor pepper" } },
  ] satisfies IngredientContent[],
};

export interface ProductCategoryContent {
  id: string;
  name: string;
  tagline: string;
  image: StoryImage;
}

/**
 * The brief's own sequence (Pickles → Sambols → Thokku → Chilli Pastes →
 * Seafood → Masalas → Spices) is adapted to the 6 real categories this
 * project actually has photography for — no "Thokku" entry exists,
 * since no real Thokku photography does either.
 */
export const productStoryCategories: ProductCategoryContent[] = [
  { id: "pickles", name: "Pickles", tagline: "Mango, tempered with mustard and chilli.", image: { src: "/images/products/best-sellers/Mango-Pickle-Large.webp", alt: "Real Oristor mango pickle" } },
  { id: "pickled-vegetables", name: "Pickled Vegetables", tagline: "Jackfruit, banana blossom, lotus — preserved the traditional way.", image: { src: "/images/products/export/oristor-brine-in-Jackfruit-1.webp", alt: "Real Oristor jackfruit in brine" } },
  { id: "chilli-pastes", name: "Chilli Pastes", tagline: "Built for heat, built for flavour.", image: { src: "/images/products/best-sellers/Chili-Paste-Large.png", alt: "Real Oristor chilli paste" } },
  { id: "seafood", name: "Seafood", tagline: "Dried, salted, sun-true to the coast.", image: { src: "/images/products/best-sellers/Sprats-Large.webp", alt: "Real Oristor dried sprats" } },
  { id: "masalas", name: "Masalas", tagline: "Blended for chicken, fish, and everything between.", image: { src: "/images/products/export/chicken-masala.png", alt: "Real Oristor chicken masala" } },
  { id: "spices", name: "Spices", tagline: "The foundation of every Oristor kitchen.", image: { src: "/images/products/export/curry-powder.webp", alt: "Real Oristor curry powder" } },
];

export interface OristorValue {
  letter: string;
  word: string;
  description: string;
}

/**
 * The user's own authored seven-value acrostic for this page specifically
 * — confirmed with the user this is deliberately distinct from
 * docs/blueprint.md's own, different 10-value "Brand values" list, not a
 * replacement for it.
 */
export const oristorValues: OristorValue[] = [
  { letter: "O", word: "Originality", description: "Authentic Sri Lankan flavours from time-honoured recipes." },
  { letter: "R", word: "Reliability", description: "Consistent quality and trust in every product." },
  { letter: "I", word: "Innovation", description: "Continuously refining and enhancing our offerings." },
  { letter: "S", word: "Sustainability", description: "Responsible sourcing and eco-friendly practices." },
  { letter: "T", word: "Tradition", description: "Honouring Sri Lanka's rich culinary heritage." },
  { letter: "O", word: "Outstanding Quality", description: "The highest standards in ingredients and production." },
  { letter: "R", word: "Respect", description: "Valuing customers, suppliers and ethical business practices." },
];

export const globalJourneyContent = {
  title: "From Sri Lanka to the World",
  // Real, approved text from docs/blueprint.md's Target Markets and
  // Strategic Pillars ("Global Export Growth").
  body: "Our ambition is to share the distinctive flavours of Sri Lanka with kitchens around the world — from the Sri Lankan diaspora to importers, supermarkets, distributors, restaurants and hotels across international markets.",
  ctaLabel: "Explore Our Export Range →",
  ctaHref: "/export",
};

export const storyCtaContent = {
  // The real ORISTOR tagline (docs/blueprint.md Section 2) — not invented.
  headline: "Feel the Difference",
  subcopy: "Authentic Sri Lankan flavour. Crafted with care. Made to be shared.",
  primaryLabel: "Explore Products",
  primaryHref: "/products",
  secondaryLabel: "Meet The Oristor",
  secondaryHref: "/contact-us",
};
