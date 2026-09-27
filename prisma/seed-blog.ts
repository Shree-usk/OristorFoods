import { prisma } from "../src/lib/db";
import * as recipeRepository from "../src/repositories/recipe.repository";

// Blog (STORY-021) demo content. Brand stories, recipe/video embeds and
// cooking content, independent of the Recipe Centre, Cooking Tips and Food
// Academy. Design: .superpowers/sdd/2026-09-26-blog/

const authors = [
  {
    slug: "amara-perera",
    name: "Amara Perera",
    bio: "Amara leads Oristor's product development and has spent over a decade sourcing spices directly from growers across Sri Lanka.",
    avatarUrl: "/images/blog/authors/amara-perera.jpg",
  },
  {
    slug: "nadeesha-fernando",
    name: "Nadeesha Fernando",
    bio: "Nadeesha is a home cook and recipe developer who writes about bringing traditional Sri Lankan flavours into everyday cooking.",
    avatarUrl: "/images/blog/authors/nadeesha-fernando.jpg",
  },
  {
    slug: "kamal-de-silva",
    name: "Kamal de Silva",
    bio: "Kamal is Oristor's in-house food historian, researching the origins and regional variations of Sri Lankan cuisine.",
    avatarUrl: "/images/blog/authors/kamal-de-silva.jpg",
  },
] as const;

type AuthorSlug = (typeof authors)[number]["slug"];

const tags = [
  { slug: "spices", name: "Spices" },
  { slug: "sri-lankan-cuisine", name: "Sri Lankan Cuisine" },
  { slug: "cooking-tips", name: "Cooking Tips" },
  { slug: "brand-stories", name: "Brand Stories" },
  { slug: "health", name: "Health" },
] as const;

type TagSlug = (typeof tags)[number]["slug"];

// Real seeded Recipe (prisma/seed-recipes.ts), referenced here by slug so
// the embed token resolves against a real, published row.
const linkableRecipeSlugs = ["sri-lankan-chicken-curry"] as const;

interface SeedPost {
  slug: string;
  title: string;
  heroImageUrl: string | null;
  excerpt: string;
  bodyContent: string;
  author: AuthorSlug;
  readingTimeMinutes?: number;
  status: "Draft" | "Scheduled" | "Published" | "Archived";
  publishedAt: string | null;
  tagSlugs: TagSlug[];
}

const posts: SeedPost[] = [
  {
    slug: "the-story-behind-our-roasted-curry-powder",
    title: "The Story Behind Our Roasted Curry Powder",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    excerpt: "Three generations of roasting technique, and why we refused to shortcut the process when we scaled up production.",
    bodyContent: `## A Recipe Passed Down, Not Written Down

Our roasted curry powder started as a family recipe with no measurements written anywhere — just a grandmother's sense of when the coriander had turned the right shade of brown. Building a repeatable production process from that took years.

### Staying True to the Original

- Every batch is still dry-roasted, never toasted with oil
- We source coriander and cumin from the same growers our family has worked with for decades
- Small-batch runs mean the roasting can be watched, not timed

This is the same blend that goes into our Sri Lankan Chicken Curry, one of the dishes it was originally developed for.`,
    author: "amara-perera",
    readingTimeMinutes: 5,
    status: "Published",
    publishedAt: "2026-06-01",
    tagSlugs: ["spices", "brand-stories"],
  },
  {
    slug: "five-spices-every-sri-lankan-kitchen-needs",
    title: "Five Spices Every Sri Lankan Kitchen Needs",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    excerpt: "If you're stocking a Sri Lankan pantry for the first time, start with these five before anything else.",
    bodyContent: `## Building a Sri Lankan Pantry

You don't need forty jars on a spice rack to cook well. A handful of core spices, used properly, will take you through most everyday Sri Lankan dishes.

### The Essentials

- Roasted curry powder, for depth in meat and fish curries
- Raw curry powder, for vegetable dishes where a lighter flavour is wanted
- Turmeric, for colour and its mild, earthy bitterness
- Dried curry leaves, for tempering
- Chilli powder, adjusted to your own heat tolerance

Start small, buy whole spices where you can, and grind only what you'll use within a few months.`,
    author: "nadeesha-fernando",
    readingTimeMinutes: 4,
    status: "Published",
    publishedAt: "2026-06-15",
    tagSlugs: ["spices", "cooking-tips", "sri-lankan-cuisine"],
  },
  {
    slug: "how-to-make-restaurant-style-chicken-curry-at-home",
    title: "How to Make Restaurant-Style Chicken Curry at Home",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    excerpt: "The technique differences between a rushed weeknight curry and one that tastes like it came from a proper Sri Lankan kitchen.",
    bodyContent: `## What Actually Makes the Difference

Most home versions of Sri Lankan chicken curry go wrong in the same two places: the onions aren't cooked down long enough, and the spices go in too late to properly bloom in the oil.

[[recipe:sri-lankan-chicken-curry]]

### Watch the Technique

A video is often clearer than a written method for the tempering step, since timing matters more than exact measurements.

[[video:https://www.youtube.com/watch?v=dQw4w9WgXcQ]]

### After You've Made It Once

Once you've made the recipe as written, start adjusting the chilli level and the amount of coconut milk to suit your own taste. The base method stays the same either way.`,
    author: "nadeesha-fernando",
    readingTimeMinutes: 7,
    status: "Published",
    publishedAt: "2026-07-05",
    tagSlugs: ["sri-lankan-cuisine", "cooking-tips"],
  },
  {
    slug: "a-brief-history-of-ceylon-spice-trade",
    title: "A Brief History of the Ceylon Spice Trade",
    heroImageUrl: "/images/products/export/Kithul-Jaggery-500g.png",
    excerpt: "Long before it was a food brand's marketing story, Ceylon cinnamon shaped centuries of maritime trade.",
    bodyContent: `## An Island on the Spice Route

Sri Lanka's position in the Indian Ocean made it a natural stop for traders moving cinnamon, pepper and cardamom between Asia, the Middle East and Europe, centuries before the modern spice industry existed.

### Cinnamon's Outsized Role

- Ceylon cinnamon was, for a time, worth more by weight than many other traded goods
- Control of the cinnamon-producing coastal regions changed hands between several colonial powers
- The techniques used to peel and roll cinnamon bark by hand are largely unchanged today

That same coastline is still where much of the region's spice trade is centred.`,
    author: "kamal-de-silva",
    readingTimeMinutes: 6,
    status: "Published",
    publishedAt: "2026-05-10",
    tagSlugs: ["sri-lankan-cuisine", "brand-stories"],
  },
  {
    slug: "understanding-the-health-benefits-of-turmeric",
    title: "Understanding the Health Benefits of Turmeric",
    heroImageUrl: "/images/products/export/Kithul-Jaggery-500g.png",
    excerpt: "Turmeric shows up in almost every Sri Lankan curry base. Here's what's actually behind its reputation.",
    bodyContent: `## More Than a Colouring Agent

Turmeric's bright yellow colour is the most visible thing it brings to a dish, but it's included in Sri Lankan cooking for more than appearance.

### What the Research Says

- Curcumin, turmeric's main active compound, has been studied for its anti-inflammatory properties
- Turmeric is often paired with black pepper, which may improve curcumin absorption
- Traditional use in Sri Lanka includes turmeric mixed with warm milk as a home remedy

As with most single ingredients, the amount used in everyday cooking is modest compared to concentrated supplements, so treat it as a flavourful addition rather than a substitute for medical advice.`,
    author: "kamal-de-silva",
    readingTimeMinutes: 5,
    status: "Published",
    publishedAt: "2026-07-20",
    tagSlugs: ["health", "spices"],
  },
  {
    slug: "seasonal-cooking-what-to-make-during-avurudu",
    title: "Seasonal Cooking: What to Make During Avurudu",
    heroImageUrl: "/images/products/export/Kithul-Jaggery-500g.png",
    excerpt: "The Sinhala and Tamil New Year table has its own rhythm. Here's how to plan a menu around it.",
    bodyContent: `## Cooking Around the Auspicious Times

Avurudu food traditions are built around timing as much as taste, with certain dishes prepared to be eaten the moment the new year officially begins.

### A Simple Avurudu Menu

- Kiribath (milk rice) as the first dish of the new year
- Lunu miris on the side, for heat and acidity
- Kokis and other sweetmeats made in the days beforehand

You don't need every traditional dish on the table at once — start with kiribath and build the rest of the menu around what you can realistically prepare.`,
    author: "nadeesha-fernando",
    readingTimeMinutes: 4,
    status: "Published",
    publishedAt: "2026-04-05",
    tagSlugs: ["sri-lankan-cuisine", "brand-stories"],
  },
  {
    slug: "our-approach-to-sustainable-spice-sourcing",
    title: "Our Approach to Sustainable Spice Sourcing",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    excerpt: "Sourcing directly from growers isn't just about quality — it changes how the whole supply chain behaves.",
    bodyContent: `## Why We Buy Direct

Working directly with growers, rather than through intermediaries, lets us pay a fairer price and be specific about the quality we need without adding cost elsewhere in the chain.

### What This Looks Like in Practice

- Long-term relationships with a small number of farms, rather than switching suppliers for marginal price gains
- Regular visits to see growing and harvesting conditions firsthand
- Paying for quality attributes, like proper drying time, that a spot-market price wouldn't reward

This costs more than sourcing on the open market, and we think it's worth it.`,
    author: "amara-perera",
    readingTimeMinutes: 5,
    status: "Published",
    publishedAt: "2026-08-01",
    tagSlugs: ["brand-stories", "spices"],
  },
  {
    slug: "a-beginners-guide-to-tempering-spices",
    title: "A Beginner's Guide to Tempering Spices",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    excerpt: "Tempering looks intimidating the first time you try it. It isn't — you just need to move fast once the oil is hot.",
    bodyContent: `## The Sixty-Second Technique

Tempering whole spices in hot oil is one of the fastest techniques in Sri Lankan cooking to learn, and one of the easiest to get wrong the first time simply because it moves quickly.

[[recipe:this-slug-does-not-exist]]

### Getting the Order Right

- Mustard seeds go in first, and should splutter within seconds
- Curry leaves go in next — they'll pop loudly, so stand back
- Dried chillies go in last, so they don't burn and turn bitter

Have everything measured out before the oil goes on the heat. There's no time to measure once the spluttering starts.`,
    author: "nadeesha-fernando",
    readingTimeMinutes: 3,
    status: "Published",
    publishedAt: "2026-08-12",
    tagSlugs: ["cooking-tips", "sri-lankan-cuisine"],
  },
  {
    slug: "how-oristor-selects-its-growers",
    title: "How Oristor Selects Its Growers",
    heroImageUrl: null,
    excerpt: "An early draft covering the criteria our sourcing team uses when evaluating a new grower partnership.",
    bodyContent: `## A Draft, Still Being Reviewed

This piece is still being fact-checked with our sourcing team before it goes live. The current draft outlines soil, harvest timing and post-harvest handling as the three main evaluation criteria, but the specifics need another pass before publishing.`,
    author: "amara-perera",
    status: "Draft",
    publishedAt: null,
    tagSlugs: [],
  },
  {
    slug: "everything-you-need-to-know-about-jaggery",
    title: "Everything You Need to Know About Jaggery",
    heroImageUrl: "/images/products/export/Kithul-Jaggery-500g.png",
    excerpt: "Kithul jaggery isn't just a substitute for sugar — it brings its own flavour to Sri Lankan sweets.",
    bodyContent: `## Not a One-for-One Sugar Swap

Kithul jaggery carries a mineral, faintly smoky flavour that shapes a dessert rather than simply sweetening it, so it isn't a direct one-for-one substitute for white sugar in most recipes.

### Where It Shines

- Watalappan, where its caramel notes are essential
- Kokis dipping syrup
- Sweetened curd (kiri peni)

Store jaggery tightly wrapped in a cool, dry place — it softens and can develop mould in humid conditions if left exposed.`,
    author: "kamal-de-silva",
    readingTimeMinutes: 4,
    status: "Published",
    publishedAt: "2026-03-20",
    tagSlugs: ["health", "sri-lankan-cuisine"],
  },
  {
    slug: "our-plans-for-next-years-product-lineup",
    title: "Our Plans for Next Year's Product Lineup",
    heroImageUrl: "/images/products/export/curry-powder.webp",
    excerpt: "A preview of what's coming to the Oristor range, scheduled to publish once the announcement is public.",
    bodyContent: `## Coming Soon

We're working on several new blends for next year's lineup, including a smoked chilli powder and a travel-sized curry powder pack. Full details will follow once packaging is finalised.`,
    author: "kamal-de-silva",
    readingTimeMinutes: 3,
    status: "Published",
    publishedAt: "2099-01-01",
    tagSlugs: ["brand-stories"],
  },
];

interface SeedComment {
  postSlug: string;
  authorName: string;
  authorEmail: string;
  customer: "nadeesha" | "kamal" | null;
  body: string;
  status: "Pending" | "Approved" | "Rejected" | "Hidden";
}

const comments: SeedComment[] = [
  {
    postSlug: "the-story-behind-our-roasted-curry-powder",
    authorName: "Nadeesha P.",
    authorEmail: "nadeesha.demo@oristor.test",
    customer: "nadeesha",
    body: "Loved reading about the family history here — you can really taste the extra care in the roasting.",
    status: "Approved",
  },
  {
    postSlug: "the-story-behind-our-roasted-curry-powder",
    authorName: "Guest Reader",
    authorEmail: "guest.reader@example.com",
    customer: null,
    body: "Would love to see a video of the roasting process one day!",
    status: "Approved",
  },
  {
    postSlug: "five-spices-every-sri-lankan-kitchen-needs",
    authorName: "Kamal R.",
    authorEmail: "kamal.demo@oristor.test",
    customer: "kamal",
    body: "Great starter list. I'd add pandan leaf for rice dishes, but this covers the essentials well.",
    status: "Approved",
  },
  {
    postSlug: "five-spices-every-sri-lankan-kitchen-needs",
    authorName: "Anonymous Cook",
    authorEmail: "anon.cook@example.com",
    customer: null,
    body: "This is spam and should not be visible.",
    status: "Pending",
  },
  {
    postSlug: "how-to-make-restaurant-style-chicken-curry-at-home",
    authorName: "Home Chef",
    authorEmail: "home.chef@example.com",
    customer: null,
    body: "Made this exactly as described and it really did taste like a restaurant version. The tempering tip made the biggest difference.",
    status: "Approved",
  },
  {
    postSlug: "how-to-make-restaurant-style-chicken-curry-at-home",
    authorName: "Curious Reader",
    authorEmail: "curious.reader@example.com",
    customer: null,
    body: "Checking whether this comment shows up before moderation.",
    status: "Pending",
  },
];

function requireId(map: Map<string, string>, slug: string): string {
  const id = map.get(slug);
  if (!id) {
    throw new Error(`Unknown seed slug: ${slug}`);
  }
  return id;
}

export async function seedBlog(): Promise<{
  authors: number;
  tags: number;
  posts: number;
  published: number;
  drafts: number;
  scheduledIntoFuture: number;
  comments: number;
  approvedComments: number;
  pendingComments: number;
}> {
  const authorIds = new Map<string, string>();
  for (const author of authors) {
    const created = await prisma.blogAuthor.create({
      data: {
        slug: author.slug,
        name: author.name,
        bio: author.bio,
        avatarUrl: author.avatarUrl,
      },
    });
    authorIds.set(author.slug, created.id);
  }

  const tagIds = new Map<string, string>();
  for (const tag of tags) {
    const created = await prisma.blogTag.create({
      data: { slug: tag.slug, name: tag.name },
    });
    tagIds.set(tag.slug, created.id);
  }

  // Real seeded Recipe (prisma/seed-recipes.ts), looked up by slug to
  // verify the [[recipe:...]] embed token used in bodyContent below
  // resolves against a real, published row rather than a fabricated slug.
  // The token itself is resolved at render time by the embed-rendering
  // service (a later task), not here.
  for (const slug of linkableRecipeSlugs) {
    const recipe = await recipeRepository.findPublishedRecipeBySlug(slug);
    if (!recipe) {
      throw new Error(`Unknown seed recipe slug: ${slug}`);
    }
  }

  const postIds = new Map<string, string>();
  for (const post of posts) {
    const created = await prisma.blogPost.create({
      data: {
        slug: post.slug,
        title: post.title,
        heroImageUrl: post.heroImageUrl,
        excerpt: post.excerpt,
        bodyContent: post.bodyContent,
        authorId: requireId(authorIds, post.author),
        readingTimeMinutes: post.readingTimeMinutes ?? null,
        status: post.status,
        publishedAt: post.publishedAt ? new Date(`${post.publishedAt}T09:00:00Z`) : null,
        tags: post.tagSlugs.length
          ? { create: post.tagSlugs.map((tagSlug) => ({ tagId: requireId(tagIds, tagSlug) })) }
          : undefined,
      },
    });
    postIds.set(post.slug, created.id);
  }

  // Demo customers for comment cross-links: reuse the same demo users
  // prisma/seed.ts creates for reviews/Q&A (nadeesha.demo@oristor.test,
  // kamal.demo@oristor.test) when present, otherwise create dedicated
  // fallback users so the "references a real seeded User id" requirement
  // still holds even if this seed is ever run in isolation.
  async function findOrCreateDemoUser(email: string, name: string): Promise<string> {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return existing.id;
    }
    const created = await prisma.user.create({ data: { email, name } });
    return created.id;
  }

  const customerIds: Record<"nadeesha" | "kamal", string> = {
    nadeesha: await findOrCreateDemoUser("nadeesha.demo@oristor.test", "Nadeesha P."),
    kamal: await findOrCreateDemoUser("kamal.demo@oristor.test", "Kamal R."),
  };

  for (const comment of comments) {
    await prisma.blogComment.create({
      data: {
        postId: requireId(postIds, comment.postSlug),
        authorName: comment.authorName,
        authorEmail: comment.authorEmail,
        customerId: comment.customer ? customerIds[comment.customer] : null,
        body: comment.body,
        status: comment.status,
      },
    });
  }

  return {
    authors: authors.length,
    tags: tags.length,
    posts: posts.length,
    published: posts.filter((post) => post.status === "Published").length,
    drafts: posts.filter((post) => post.status === "Draft").length,
    scheduledIntoFuture: posts.filter((post) => post.status === "Published" && post.publishedAt !== null && new Date(post.publishedAt) > new Date()).length,
    comments: comments.length,
    approvedComments: comments.filter((comment) => comment.status === "Approved").length,
    pendingComments: comments.filter((comment) => comment.status === "Pending").length,
  };
}
