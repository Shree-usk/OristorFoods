import path from "node:path";

import { Document, Font, Image, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import sharp from "sharp";

import { readLocalMediaFile } from "@/lib/resolve-local-media-path";

// See recipe-pdf.service.tsx's doc comment: @react-pdf/renderer needs real
// font files (fontkit), not next/font/google's CSS mechanism. Font.register
// is idempotent per family+weight, safe to repeat across module loads.
const FONT_DIR = path.join(process.cwd(), "node_modules");

Font.register({
  family: "Cormorant Garamond",
  fonts: [{ src: path.join(FONT_DIR, "@fontsource/cormorant-garamond/files/cormorant-garamond-latin-700-normal.woff"), fontWeight: 700 }],
});

Font.register({
  family: "Inter",
  fonts: [
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-600-normal.woff"), fontWeight: 600 },
    { src: path.join(FONT_DIR, "@fontsource/inter/files/inter-latin-700-normal.woff"), fontWeight: 700 },
  ],
});

// Hex values from docs/blueprint.md Section 2's brand color table — same
// palette the other 5 PDF services use.
const COLORS = {
  ivory: "#FAF7F2",
  charcoal: "#2F2B2A",
  gold: "#CDAF52",
  chilliRed: "#B22222",
  stoneGrey: "#8A817C",
  softBorder: "#E5DED5",
};

const styles = StyleSheet.create({
  page: { backgroundColor: COLORS.ivory, padding: 40, fontFamily: "Inter", fontSize: 9, color: COLORS.charcoal },
  title: { fontFamily: "Cormorant Garamond", fontSize: 24, marginBottom: 2 },
  subtitle: { fontSize: 10, color: COLORS.stoneGrey, marginBottom: 20, paddingBottom: 16, borderBottom: `1pt solid ${COLORS.softBorder}` },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  card: { width: 160, marginBottom: 16, border: `1pt solid ${COLORS.softBorder}`, borderRadius: 4, padding: 8 },
  imageBox: { width: "100%", height: 130, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", marginBottom: 6 },
  image: { width: "100%", height: "100%", objectFit: "contain" },
  noImageText: { fontSize: 7, color: COLORS.stoneGrey },
  featuredBadge: { fontSize: 6, color: COLORS.ivory, backgroundColor: COLORS.chilliRed, borderRadius: 2, paddingHorizontal: 4, paddingVertical: 2, alignSelf: "flex-start", marginBottom: 4 },
  productName: { fontFamily: "Cormorant Garamond", fontSize: 11, fontWeight: 700 },
  productMeta: { fontSize: 7, color: COLORS.stoneGrey, marginTop: 2 },
  productDescription: { fontSize: 7, color: COLORS.charcoal, marginTop: 4 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 8, color: COLORS.stoneGrey, textAlign: "center" },
});

export interface ExportCataloguePdfProduct {
  id: string;
  sku: string;
  name: string;
  shortDescription: string | null;
  exportDescription: string | null;
  weightGrams: number | null;
  isExportFeatured?: boolean;
  images: { url: string; altText: string | null }[];
}

type ResolvedImage = { data: Buffer; format: "jpg" | "png" } | null;

// @react-pdf/image (the renderer's own image decoder) only understands
// JPEG and PNG — confirmed by reading its source, no native webp/avif
// support. A product's primary image stored as .webp (a real, common
// case in this codebase's own seeded assets) is converted via sharp below
// before being handed to <Image>; any other unsupported format (avif,
// svg, etc.) still falls back to "no image" — matches the spec's
// "handle... missing optional data" requirement rather than crashing PDF
// generation for one unusual file.
function nativeImageFormat(url: string): "jpg" | "png" | null {
  const ext = url.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  if (ext === "png") return "png";
  return null;
}

function isWebp(url: string): boolean {
  return url.split(".").pop()?.toLowerCase() === "webp";
}

// `data` is a Media-Library-sourced file — admin-authored, not a trusted
// constant — so this stays defensive even though real product photos are
// expected nowhere near these bounds: skip (rather than decode) anything
// implausibly large, and cap the re-encoded output's pixel dimensions so
// one oversized source image can't spike memory during PDF generation.
const MAX_CONVERTIBLE_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_CONVERTED_DIMENSION_PX = 2000;

// JPEG, not PNG: measured directly against this codebase's own real
// product photos (see docs/architecture-decisions.md's staging
// acceptance review entry) — PNG's lossless encoding runs ~8x larger than
// JPEG at quality 85 for the same photographic content, and the catalogue
// is downloaded by overseas buyers on potentially slow connections, so
// the size difference is a real buyer-facing cost, not a cosmetic one. No
// product packshot in this catalogue needs alpha transparency.
async function convertWebpToJpeg(data: Buffer): Promise<Buffer | null> {
  if (data.length > MAX_CONVERTIBLE_IMAGE_BYTES) return null;
  try {
    return await sharp(data)
      .resize({ width: MAX_CONVERTED_DIMENSION_PX, height: MAX_CONVERTED_DIMENSION_PX, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch {
    // Corrupt/truncated/not-actually-a-webp-despite-the-extension file —
    // never let one bad asset crash PDF generation. sharp's own error
    // messages can include the input buffer's size/libvips internals;
    // swallowed here rather than surfaced, so nothing server-side ever
    // reaches the PDF response.
    return null;
  }
}

async function resolveProductImage(product: ExportCataloguePdfProduct): Promise<ResolvedImage> {
  const url = product.images[0]?.url;
  if (!url) return null;

  const native = nativeImageFormat(url);
  if (native) {
    const data = await readLocalMediaFile(url);
    return data ? { data, format: native } : null;
  }

  if (isWebp(url)) {
    const data = await readLocalMediaFile(url);
    if (!data) return null;
    const converted = await convertWebpToJpeg(data);
    return converted ? { data: converted, format: "jpg" } : null;
  }

  return null;
}

function formatPackSize(weightGrams: number | null): string | null {
  if (!weightGrams) return null;
  return weightGrams >= 1000 ? `${(weightGrams / 1000).toFixed(weightGrams % 1000 === 0 ? 0 : 1)}kg` : `${weightGrams}g`;
}

function ExportCataloguePdfDocument({ products, images }: { products: ExportCataloguePdfProduct[]; images: Map<string, ResolvedImage> }) {
  return (
    <Document title="ORISTOR Export & Wholesale Catalogue">
      <Page size="A4" style={styles.page} wrap>
        <Text style={styles.title}>Export & Wholesale Catalogue</Text>
        <Text style={styles.subtitle}>
          ORISTOR Food Products (Pvt) Ltd · Generated {new Date().toLocaleDateString("en-LK", { dateStyle: "medium" })} · {products.length}{" "}
          {products.length === 1 ? "product" : "products"}
        </Text>

        <View style={styles.grid}>
          {products.map((product) => {
            const image = images.get(product.id) ?? null;
            const description = product.exportDescription ?? product.shortDescription;
            const packSize = formatPackSize(product.weightGrams);
            return (
              <View key={product.id} style={styles.card} wrap={false}>
                {product.isExportFeatured && <Text style={styles.featuredBadge}>FEATURED</Text>}
                <View style={styles.imageBox}>
                  {image ? (
                    // eslint-disable-next-line jsx-a11y/alt-text -- @react-pdf/renderer's Image, not an HTML <img>; it has no alt prop
                    <Image src={{ data: image.data, format: image.format }} style={styles.image} />
                  ) : (
                    <Text style={styles.noImageText}>No image available</Text>
                  )}
                </View>
                <Text style={styles.productName}>{product.name}</Text>
                <Text style={styles.productMeta}>
                  SKU {product.sku}
                  {packSize ? ` · ${packSize}` : ""}
                </Text>
                {description && <Text style={styles.productDescription}>{description}</Text>}
              </View>
            );
          })}
        </View>

        <Text style={styles.footer} fixed>
          ORISTOR — Feel the Difference · oristor.com/export
        </Text>
      </Page>
    </Document>
  );
}

/**
 * Includes exactly the products passed in — never fetches by any other
 * criterion — so the caller (the public PDF route) is the one place that
 * enforces "Published + isExportEnabled" visibility; this function never
 * sees an unpublished/export-disabled product because the caller never
 * hands it one. No pricing, margins, or internal notes are read or
 * rendered here at all.
 */
export async function renderExportCataloguePdf(products: ExportCataloguePdfProduct[]): Promise<Buffer> {
  const images = new Map<string, ResolvedImage>(await Promise.all(products.map(async (product) => [product.id, await resolveProductImage(product)] as const)));
  return renderToBuffer(<ExportCataloguePdfDocument products={products} images={images} />);
}
