import type { CookingTipStatus, VideoProvider } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/db";
import * as productRepository from "../src/repositories/product.repository";

// Cooking Tips (STORY-019) demo content. Short-form video/photo tips,
// independent of the Recipe Centre. Design:
// docs/superpowers/specs/2026-09-25-video-cooking-tips-design.md.

// Real seeded Products (prisma/seed.ts), referenced here by slug so at
// least one tip links to a real productId.
const linkableProductSlugs = ["roasted-curry-powder-100g", "chilli-powder-100g"] as const;
type LinkableProductSlug = (typeof linkableProductSlugs)[number];

interface SeedCookingTip {
  slug: string;
  title: string;
  summary: string;
  bodyContent: string;
  videoUrl?: string;
  videoProvider?: VideoProvider;
  imageUrl?: string;
  topicTag: string;
  status: CookingTipStatus;
  publishedAt: string | null;
  productSlugs?: LinkableProductSlug[];
}

const cookingTips: SeedCookingTip[] = [
  {
    slug: "how-to-hold-a-knife",
    title: "How to Hold a Knife Properly",
    summary: "The claw grip that keeps your fingers safe and your cuts even, in under a minute.",
    bodyContent:
      "Curl your fingertips under and grip the blade sides with your thumb and forefinger. Let the knuckles guide the blade — never your fingertips. Practise on an onion first: slow, even slices build the habit faster than speed ever will.",
    videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    videoProvider: "Youtube",
    topicTag: "knife-skills",
    status: "Published",
    publishedAt: "2026-08-01",
  },
  {
    slug: "julienne-vs-brunoise",
    title: "Julienne vs Brunoise: Knowing the Difference",
    summary: "Two classic knife cuts, side by side, so your carrot sticks and your dice never get confused again.",
    bodyContent:
      "Julienne is a fine matchstick cut, about 2mm thick and 5cm long — perfect for stir-fries and garnishes. Brunoise takes that julienne and dices it down further into tiny, even cubes, ideal for a fine mirepoix. Both start from the same squared-off vegetable.",
    imageUrl: "/images/products/misc/Masala.webp",
    topicTag: "knife-skills",
    status: "Published",
    publishedAt: "2026-08-05",
  },
  {
    slug: "sharpening-your-knife-at-home",
    title: "Sharpening Your Knife at Home",
    summary: "A whetstone walkthrough for getting a proper edge back without a trip to the market.",
    bodyContent:
      "Soak the stone for ten minutes before you start. Hold the blade at a consistent 15-20 degree angle and draw it across the stone in smooth strokes, alternating sides evenly. Finish on the finer grit, then strop lightly on a leather belt or the back of an apron to remove the burr.",
    topicTag: "knife-skills",
    status: "Draft",
    publishedAt: null,
  },
  {
    slug: "tempering-spices-in-oil",
    title: "Tempering Spices in Oil (Tadka)",
    summary: "The sixty-second technique that unlocks the aroma in mustard seeds, curry leaves and dried chillies.",
    bodyContent:
      "Heat oil until it shimmers, then add mustard seeds first — they should splutter within seconds. Follow with curry leaves (stand back, they'll pop) and dried chillies last so they don't scorch. Pour the whole tempering, oil and all, straight over your dhal or curry while it's still sizzling.",
    videoUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
    videoProvider: "Youtube",
    topicTag: "spice-tempering",
    status: "Published",
    publishedAt: "2026-07-20",
    productSlugs: ["roasted-curry-powder-100g"],
  },
  {
    slug: "toasting-whole-spices",
    title: "Toasting Whole Spices Before Grinding",
    summary: "Why a dry pan for two minutes makes such a difference to your homemade curry powder.",
    bodyContent:
      "Add whole coriander, cumin and fennel seeds to a dry pan over medium-low heat. Shake the pan often and toast just until fragrant and a shade darker — thirty seconds past that and they turn bitter. Cool completely before grinding, otherwise trapped steam will clump the powder.",
    imageUrl: "/images/products/export/curry-powder.webp",
    topicTag: "spice-tempering",
    status: "Published",
    publishedAt: "2026-07-25",
    productSlugs: ["roasted-curry-powder-100g", "chilli-powder-100g"],
  },
  {
    slug: "blooming-chilli-powder-safely",
    title: "Blooming Chilli Powder Without Burning It",
    summary: "Take the pan off the heat before the chilli powder goes in — the residual heat is all you need.",
    bodyContent:
      "Chilli powder burns almost instantly in hot oil, turning bitter and acrid. Pull the pan off the heat (or reduce it right down) before adding it, stir for a few seconds in the residual warmth, then return to the stove or add your liquid immediately.",
    videoUrl: "https://vimeo.com/76979871",
    videoProvider: "Vimeo",
    topicTag: "spice-tempering",
    status: "Draft",
    publishedAt: null,
    productSlugs: ["chilli-powder-100g"],
  },
  {
    slug: "storing-curry-powder-for-freshness",
    title: "Storing Curry Powder for Maximum Freshness",
    summary: "Airtight, dark and cool — the three things that keep ground spice potent for months, not weeks.",
    bodyContent:
      "Ground spices lose aroma fast once exposed to air, light and heat. Keep curry powder in a small, fully-filled airtight jar (less headspace means less oxidation) in a cupboard away from the stove. Buy in quantities you'll use within three to four months rather than stocking up in bulk.",
    imageUrl: "/images/products/export/curry-powder.webp",
    topicTag: "storage",
    status: "Published",
    publishedAt: "2026-06-10",
    productSlugs: ["roasted-curry-powder-100g"],
  },
  {
    slug: "keeping-coconut-milk-fresh",
    title: "Keeping Opened Coconut Milk Fresh",
    summary: "What to do with the rest of the tin once you've only used half.",
    bodyContent:
      "Transfer leftover coconut milk to an airtight container — never leave it in the tin — and refrigerate for up to three days. For longer storage, freeze it in an ice-cube tray so you can thaw exactly the amount a recipe needs.",
    topicTag: "storage",
    status: "Published",
    publishedAt: "2026-06-15",
  },
  {
    slug: "reviving-stale-desiccated-coconut",
    title: "Reviving Stale Desiccated Coconut",
    summary: "A quick steam trick to bring dried-out shredded coconut back to life before it goes in a sambol.",
    bodyContent:
      "Sprinkle the desiccated coconut lightly with warm water or coconut milk, then steam it for two to three minutes, or cover and microwave in short bursts. Fluff with a fork once cooled. It won't be quite fresh-grated, but it recovers enough softness for sambols and sweets.",
    videoUrl: "https://cdn.oristor.test/videos/reviving-desiccated-coconut.mp4",
    videoProvider: "SelfHosted",
    topicTag: "storage",
    status: "Published",
    publishedAt: "2026-06-22",
  },
  {
    slug: "resting-meat-after-cooking",
    title: "Why You Should Rest Meat Before Cutting",
    summary: "Five to ten minutes off the heat keeps the juices in the meat instead of on your cutting board.",
    bodyContent:
      "Cutting into meat straight off the heat lets the juices run out all at once, leaving the meat drier. Tent it loosely with foil and let it rest — five minutes for smaller cuts, up to fifteen for a whole roast — so the juices redistribute evenly before you carve.",
    imageUrl: "/images/products/export/chicken-masala.png",
    topicTag: "technique",
    status: "Published",
    publishedAt: "2026-05-30",
  },
];

function requireId(map: Map<string, string>, slug: string): string {
  const id = map.get(slug);
  if (!id) {
    throw new Error(`Unknown seed slug: ${slug}`);
  }
  return id;
}

export async function seedCookingTips(): Promise<{ cookingTips: number; published: number; drafts: number }> {
  const productIds = new Map<string, string>();
  for (const slug of linkableProductSlugs) {
    const product = await productRepository.findProductBySlug(slug);
    if (!product) {
      throw new Error(`Unknown seed product slug: ${slug}`);
    }
    productIds.set(slug, product.id);
  }

  for (const tip of cookingTips) {
    await prisma.cookingTip.create({
      data: {
        slug: tip.slug,
        title: tip.title,
        summary: tip.summary,
        bodyContent: tip.bodyContent,
        videoUrl: tip.videoUrl ?? null,
        videoProvider: tip.videoProvider ?? null,
        imageUrl: tip.imageUrl ?? null,
        topicTag: tip.topicTag,
        status: tip.status,
        publishedAt: tip.publishedAt ? new Date(`${tip.publishedAt}T09:00:00Z`) : null,
        productRefs: {
          create: (tip.productSlugs ?? []).map((slug) => ({ productId: requireId(productIds, slug) })),
        },
      },
    });
  }

  return {
    cookingTips: cookingTips.length,
    published: cookingTips.filter((tip) => tip.status === "Published").length,
    drafts: cookingTips.filter((tip) => tip.status === "Draft").length,
  };
}
