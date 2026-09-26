import type { FoodAcademyContentType, FoodAcademyEntryStatus } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";
import * as productRepository from "../src/repositories/product.repository";
import * as recipeRepository from "../src/repositories/recipe.repository";

// Food Academy (STORY-020) demo content. Long-form articles, guides and
// multi-section courses, independent of the Recipe Centre and Cooking Tips.
// Design: .superpowers/sdd/2026-09-26-food-academy/

const categories = [
  {
    slug: "ingredients",
    name: "Ingredients",
    description: "Understanding the spices, produce and pantry staples behind Sri Lankan cooking.",
  },
  {
    slug: "techniques",
    name: "Techniques",
    description: "Core cooking methods and skills used throughout Sri Lankan cuisine.",
  },
  {
    slug: "culture-heritage",
    name: "Culture & Heritage",
    description: "The stories, festivals and traditions behind Sri Lankan food.",
  },
  {
    slug: "spice-guide",
    name: "Spice Guide",
    description: "In-depth, multi-part guides to mastering Sri Lankan spices.",
  },
] as const;

type CategorySlug = (typeof categories)[number]["slug"];

// Real seeded Products/Recipes (prisma/seed.ts, prisma/seed-recipes.ts),
// referenced here by slug so the Course entry links to real rows.
const linkableProductSlugs = ["roasted-curry-powder-100g"] as const;
type LinkableProductSlug = (typeof linkableProductSlugs)[number];

const linkableRecipeSlugs = ["sri-lankan-chicken-curry"] as const;
type LinkableRecipeSlug = (typeof linkableRecipeSlugs)[number];

interface SeedSection {
  sectionNumber: number;
  title: string;
  bodyContent: string;
  imageUrl?: string;
}

interface SeedEntry {
  slug: string;
  title: string;
  summary: string;
  heroImageUrl?: string;
  contentType: FoodAcademyContentType;
  category: CategorySlug;
  // Markdown, or null for a Course entry with no standalone intro (its real
  // content lives entirely in `sections`).
  bodyContent: string | null;
  readingTimeMinutes?: number;
  authorName?: string;
  isFeatured: boolean;
  status: FoodAcademyEntryStatus;
  publishedAt: string | null;
  sections?: SeedSection[];
  recipeSlugs?: LinkableRecipeSlug[];
  productSlugs?: LinkableProductSlug[];
}

const entries: SeedEntry[] = [
  {
    slug: "understanding-sri-lankan-curry-powder",
    title: "Understanding Sri Lankan Curry Powder",
    summary: "What makes a roasted curry powder different from other South Asian spice blends, and how to read a label before you buy.",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    contentType: "Article",
    category: "ingredients",
    bodyContent: `## What Makes a Curry Powder "Roasted"

Sri Lankan curry powder is distinguished from most other South Asian spice blends by one deliberate step: the whole spices are dry-roasted in a pan before they're ever ground. That roasting is what gives a good Sri Lankan curry its deep, almost smoky base note — something a raw, unroasted powder can't match.

### Core Spices in a Traditional Blend

- Coriander seeds
- Cumin seeds
- Fennel seeds
- Dried curry leaves
- A small amount of rice, for colour and texture

### Reading the Label

Look for a short ingredient list of named whole spices rather than "spice blend" as a single catch-all term. For background on the wider cuisine this powder belongs to, see [Sri Lankan cuisine on Wikipedia](https://en.wikipedia.org/wiki/Sri_Lankan_cuisine).`,
    readingTimeMinutes: 6,
    authorName: "Priyanka de Silva",
    isFeatured: true,
    status: "Published",
    publishedAt: "2026-08-10",
  },
  {
    slug: "tempering-tadka-a-complete-guide",
    title: "Tempering (Tadka): A Complete Guide",
    summary: "The sixty-second technique, used at the start or end of a dish, that unlocks the aroma of whole spices in hot oil.",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    contentType: "Guide",
    category: "techniques",
    bodyContent: `## What Is Tempering?

Tempering — known locally as *thel dhaala* — is the technique of briefly frying whole spices in hot oil or ghee to release their aromatic oils before they're added to, or poured over, a finished dish.

### A Typical Sequence

- Mustard seeds first — they should splutter within seconds of hitting the oil
- Curry leaves next — stand back, they will pop
- Dried chillies last, so they don't scorch and turn bitter

### When to Temper

Some dishes are tempered at the start, building the base of the curry; others — especially dhal — are finished with a tempering poured over the top just before serving, so the aroma is at its freshest when the dish reaches the table. Read more about the technique's origins on [Wikipedia](https://en.wikipedia.org/wiki/Tadka).`,
    readingTimeMinutes: 8,
    authorName: "Oristor Food Academy Team",
    isFeatured: true,
    status: "Published",
    publishedAt: "2026-08-18",
  },
  {
    slug: "mastering-the-art-of-roasted-curry-powder",
    title: "Mastering the Art of Roasted Curry Powder",
    summary: "A four-part course on selecting, roasting and grinding your own Sri Lankan curry powder from scratch, with a chicken curry to put it to use.",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    contentType: "Course",
    category: "spice-guide",
    // No standalone intro — the course's real content lives in `sections`.
    bodyContent: null,
    authorName: "Priyanka de Silva",
    isFeatured: false,
    status: "Published",
    publishedAt: "2026-09-01",
    sections: [
      {
        sectionNumber: 1,
        title: "A Short History of Sri Lankan Curry Powder",
        bodyContent:
          "Roasted curry powder developed as coastal trade brought coriander, cumin and fennel to a cuisine already built around coconut, chilli and curry leaves. Dry-roasting the spices before grinding was a way of both preserving them in a humid climate and deepening their flavour, and it became the defining trait that separates a Sri Lankan blend from its South Indian neighbours.",
      },
      {
        sectionNumber: 2,
        title: "Selecting and Balancing Your Spices",
        bodyContent:
          "Start with whole, unbroken seeds rather than pre-ground powder — coriander and cumin lose their essential oils quickly once cracked. A traditional balance leans heavily on coriander for bulk, with cumin and fennel in smaller, roughly equal amounts, and a handful of dried curry leaves for a distinct, slightly citrusy top note.",
      },
      {
        sectionNumber: 3,
        title: "The Roasting Technique",
        bodyContent:
          "Roast each spice separately in a dry pan over medium-low heat, since they darken at different rates. Coriander needs the longest, until it turns a rich reddish-brown; cumin and fennel need only a minute or two until fragrant. Keep the pan moving throughout and pour each spice onto a plate the moment it's ready so residual heat doesn't push it into bitterness.",
      },
      {
        sectionNumber: 4,
        title: "Grinding, Storing and Putting It to Use",
        bodyContent:
          "Let the roasted spices cool completely before grinding — grinding warm spices traps steam and clumps the powder. Grind in short bursts to avoid overheating the blend, then store it in a small, fully-filled airtight jar away from direct light. Try your first batch in the Sri Lankan Chicken Curry recipe linked below.",
      },
    ],
    recipeSlugs: ["sri-lankan-chicken-curry"],
    productSlugs: ["roasted-curry-powder-100g"],
  },
  {
    slug: "the-history-of-avurudu-food-traditions",
    title: "The History of Avurudu Food Traditions",
    summary: "How the Sinhala and Tamil New Year's table of milk rice, sweetmeats and sun-dried fish came to be.",
    heroImageUrl: "/images/products/export/Kithul-Jaggery-500g.png",
    contentType: "Article",
    category: "culture-heritage",
    bodyContent: `## A Table Built Around the Sun

Avurudu, the Sinhala and Tamil New Year, is timed to the sun's transition between the zodiac houses of Pisces and Aries — an astrological, not calendar, event. The food that surrounds it is built around auspicious timing as much as taste: kiribath (milk rice) is traditionally the first dish eaten once the new year officially begins.

### On the Table

- Kiribath, cut into diamonds and served with lunu miris
- Kokis and kevum, deep-fried sweetmeats made for the season
- Aggala and other jaggery-sweetened treats

This is still an early draft, pending review before it goes live on the storefront.`,
    readingTimeMinutes: 5,
    authorName: "Oristor Food Academy Team",
    isFeatured: false,
    status: "Draft",
    publishedAt: null,
  },
  {
    slug: "the-role-of-jaggery-in-sri-lankan-sweets",
    title: "The Role of Jaggery in Sri Lankan Sweets",
    summary: "Why kithul jaggery, not white sugar, is the backbone of most traditional Sri Lankan desserts.",
    heroImageUrl: "/images/products/export/Kithul-Jaggery-500g.png",
    contentType: "Article",
    category: "ingredients",
    bodyContent: `## Not Just a Sweetener

Kithul jaggery is tapped from the sap of the kithul palm and slow-boiled down into a dense, caramel-toned block. Unlike refined sugar, it carries its own mineral, faintly smoky flavour that shapes the dessert around it rather than simply sweetening it.

### Common Uses

- Watalappan
- Kokis dipping syrup
- Sweetened curd (kiri peni)

Read about how the sap is tapped and processed on [Wikipedia](https://en.wikipedia.org/wiki/Kithul_jaggery).`,
    readingTimeMinutes: 4,
    authorName: "Priyanka de Silva",
    isFeatured: false,
    status: "Published",
    publishedAt: "2026-07-22",
  },
];

function requireId(map: Map<string, string>, slug: string): string {
  const id = map.get(slug);
  if (!id) {
    throw new Error(`Unknown seed slug: ${slug}`);
  }
  return id;
}

export async function seedFoodAcademy(): Promise<{
  categories: number;
  entries: number;
  published: number;
  drafts: number;
  featured: number;
  courses: number;
}> {
  const categoryIds = new Map<string, string>();
  for (const category of categories) {
    const created = await prisma.foodAcademyCategory.create({
      data: { slug: category.slug, name: category.name, description: category.description },
    });
    categoryIds.set(category.slug, created.id);
  }

  // Real seeded Products/Recipes, looked up by slug so the Course entry
  // cross-links to real rows rather than fabricated ids.
  const productIds = new Map<string, string>();
  for (const slug of linkableProductSlugs) {
    const product = await productRepository.findProductBySlug(slug);
    if (!product) {
      throw new Error(`Unknown seed product slug: ${slug}`);
    }
    productIds.set(slug, product.id);
  }

  const recipeIds = new Map<string, string>();
  for (const slug of linkableRecipeSlugs) {
    const recipe = await recipeRepository.findPublishedRecipeBySlug(slug);
    if (!recipe) {
      throw new Error(`Unknown seed recipe slug: ${slug}`);
    }
    recipeIds.set(slug, recipe.id);
  }

  for (const entry of entries) {
    await prisma.foodAcademyEntry.create({
      data: {
        slug: entry.slug,
        title: entry.title,
        summary: entry.summary,
        heroImageUrl: entry.heroImageUrl ?? null,
        contentType: entry.contentType,
        categoryId: requireId(categoryIds, entry.category),
        bodyContent: entry.bodyContent,
        readingTimeMinutes: entry.readingTimeMinutes ?? null,
        authorName: entry.authorName ?? null,
        isFeatured: entry.isFeatured,
        status: entry.status,
        publishedAt: entry.publishedAt ? new Date(`${entry.publishedAt}T09:00:00Z`) : null,
        sections: entry.sections
          ? {
              create: entry.sections.map((section) => ({
                sectionNumber: section.sectionNumber,
                title: section.title,
                bodyContent: section.bodyContent,
                imageUrl: section.imageUrl ?? null,
              })),
            }
          : undefined,
        recipeRefs: entry.recipeSlugs
          ? { create: entry.recipeSlugs.map((slug) => ({ recipeId: requireId(recipeIds, slug) })) }
          : undefined,
        productRefs: entry.productSlugs
          ? { create: entry.productSlugs.map((slug) => ({ productId: requireId(productIds, slug) })) }
          : undefined,
      },
    });
  }

  return {
    categories: categories.length,
    entries: entries.length,
    published: entries.filter((entry) => entry.status === "Published").length,
    drafts: entries.filter((entry) => entry.status === "Draft").length,
    featured: entries.filter((entry) => entry.isFeatured).length,
    courses: entries.filter((entry) => entry.contentType === "Course").length,
  };
}
