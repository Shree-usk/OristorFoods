import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { Document, Page, renderToBuffer, StyleSheet, Text } from "@react-pdf/renderer";

import { prisma } from "../src/lib/db";

const DOWNLOADS_DIR = path.join(process.cwd(), "public", "downloads");

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 12 },
  title: { fontSize: 24, marginBottom: 12 },
  body: { fontSize: 11, lineHeight: 1.5 },
});

function PlaceholderDocument({ title, body }: { title: string; body: string }) {
  return (
    <Document title={title}>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </Page>
    </Document>
  );
}

async function writePlaceholderPdf(fileName: string, title: string, body: string): Promise<number> {
  const buffer = await renderToBuffer(<PlaceholderDocument title={title} body={body} />);
  await mkdir(DOWNLOADS_DIR, { recursive: true });
  await writeFile(path.join(DOWNLOADS_DIR, fileName), buffer);
  return buffer.length;
}

const categorySeeds = [
  { name: "Nutrition Guides", slug: "nutrition-guides", sortOrder: 0 },
  { name: "Ingredient Guides", slug: "ingredient-guides", sortOrder: 1 },
  { name: "Brand & Company", slug: "brand-company", sortOrder: 2 },
];

const resourceSeeds = [
  {
    categorySlug: "nutrition-guides",
    slug: "understanding-nutrition-labels",
    title: "Understanding Nutrition Labels",
    description: "A short guide to reading the nutrition panel on Oristor products.",
    fileName: "understanding-nutrition-labels.pdf",
    body: "Learn how to read calories, macronutrients, and sodium content on Oristor's nutrition panels, and how they relate to daily recommended values.",
    thumbnailUrl: "/images/products/export/curry-powder.webp",
  },
  {
    categorySlug: "ingredient-guides",
    slug: "sri-lankan-spice-glossary",
    title: "Sri Lankan Spice Glossary",
    description: "An illustrated glossary of the spices used across Oristor's recipes.",
    fileName: "sri-lankan-spice-glossary.pdf",
    body: "A reference glossary covering the roasted curry powders, sambols, and spice blends used throughout Oristor's recipe collection.",
    thumbnailUrl: "/images/products/export/curry-powder.webp",
  },
  {
    categorySlug: "brand-company",
    slug: "the-oristor-story",
    title: "The Oristor Story",
    description: "Our brand story, values, and sourcing commitments.",
    fileName: "the-oristor-story.pdf",
    body: "Oristor — Feel the Difference. A short brochure on our origins, brand values, and commitment to authentic Sri Lankan food.",
    thumbnailUrl: "/images/products/export/curry-powder.webp",
  },
] as const;

export async function seedDownloads(): Promise<{ categories: number; resources: number }> {
  const categoriesBySlug = new Map<string, string>();
  for (const category of categorySeeds) {
    const row = await prisma.downloadCategory.upsert({
      where: { slug: category.slug },
      update: { name: category.name, sortOrder: category.sortOrder },
      create: category,
    });
    categoriesBySlug.set(category.slug, row.id);
  }

  for (const resource of resourceSeeds) {
    const fileSizeBytes = await writePlaceholderPdf(resource.fileName, resource.title, resource.body);
    const categoryId = categoriesBySlug.get(resource.categorySlug);
    if (!categoryId) throw new Error(`Unknown category slug in resourceSeeds: ${resource.categorySlug}`);

    await prisma.downloadResource.upsert({
      where: { slug: resource.slug },
      update: {
        title: resource.title,
        description: resource.description,
        thumbnailUrl: resource.thumbnailUrl,
        fileUrl: `/downloads/${resource.fileName}`,
        fileType: "PDF",
        fileSizeBytes,
        categoryId,
        status: "Published",
      },
      create: {
        slug: resource.slug,
        title: resource.title,
        description: resource.description,
        thumbnailUrl: resource.thumbnailUrl,
        fileUrl: `/downloads/${resource.fileName}`,
        fileType: "PDF",
        fileSizeBytes,
        categoryId,
        status: "Published",
      },
    });
  }

  return { categories: categorySeeds.length, resources: resourceSeeds.length };
}
