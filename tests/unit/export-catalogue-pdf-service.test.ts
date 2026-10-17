// @vitest-environment node
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { afterAll, describe, expect, it } from "vitest";

import { renderExportCataloguePdf, type ExportCataloguePdfProduct } from "@/services/export-catalogue-pdf.service";
import { LOCAL_MEDIA_UPLOAD_DIR } from "@/services/storage/local-disk-storage.provider";

function product(overrides: Partial<ExportCataloguePdfProduct> = {}): ExportCataloguePdfProduct {
  return {
    id: "p1",
    sku: "SKU-1",
    name: "Test Product",
    shortDescription: null,
    exportDescription: null,
    weightGrams: 100,
    images: [],
    ...overrides,
  };
}

function isValidPdf(buffer: Buffer): boolean {
  return buffer.length > 0 && buffer.subarray(0, 5).toString("latin1") === "%PDF-";
}

/** @react-pdf/renderer keeps each object's own dictionary (incl. the Pages tree) uncompressed — only content streams get FlateDecode — so /Type /Pages's own /Count is readable directly off the raw bytes without a PDF-parsing dependency. */
function pageCount(buffer: Buffer): number | null {
  const match = buffer.toString("latin1").match(/\/Type\s*\/Pages[\s\S]{0,300}?\/Count\s+(\d+)/);
  return match ? Number(match[1]) : null;
}

const corruptFiles: string[] = [];
afterAll(async () => {
  await Promise.all(corruptFiles.map((file) => rm(file, { force: true })));
});

describe("export-catalogue-pdf.service — renderExportCataloguePdf", () => {
  it("renders a valid, non-trivial PDF for a single product with no image", async () => {
    const buffer = await renderExportCataloguePdf([product()]);
    expect(isValidPdf(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(500);
  });

  it("renders a valid PDF for an empty product list (every supplied id was invalid/unpublished)", async () => {
    const buffer = await renderExportCataloguePdf([]);
    expect(isValidPdf(buffer)).toBe(true);
  });

  it("does not throw for a deliberately very long product name", async () => {
    const longName = "A ".repeat(100) + "Very Long Product Name That Must Not Crash The Layout Engine";
    const buffer = await renderExportCataloguePdf([product({ name: longName })]);
    expect(isValidPdf(buffer)).toBe(true);
  });

  it("forces a page break across a large product list", async () => {
    const products = Array.from({ length: 30 }, (_, i) => product({ id: `p${i}`, sku: `SKU-${i}`, name: `Product ${i}` }));
    const buffer = await renderExportCataloguePdf(products);
    const count = pageCount(buffer);
    expect(count).not.toBeNull();
    expect(count as number).toBeGreaterThan(1);
  });

  it("embeds a supported image format (PNG) and produces a materially larger buffer than the no-image case", async () => {
    const withoutImage = await renderExportCataloguePdf([product()]);
    const withImage = await renderExportCataloguePdf([product({ images: [{ url: "/images/products/export/chicken-masala.png", altText: null }] })]);
    expect(withImage.length).toBeGreaterThan(withoutImage.length + 1000);
  });

  it("converts a real webp image via sharp and embeds it, producing a materially larger buffer than the no-image case", async () => {
    const withoutImage = await renderExportCataloguePdf([product()]);
    const withWebpImage = await renderExportCataloguePdf([product({ images: [{ url: "/images/products/export/curry-powder.webp", altText: null }] })]);
    expect(isValidPdf(withWebpImage)).toBe(true);
    expect(withWebpImage.length).toBeGreaterThan(withoutImage.length + 1000);
  });

  it("skips a missing/unreadable image file without throwing", async () => {
    const buffer = await renderExportCataloguePdf([product({ images: [{ url: "/images/products/does-not-exist.png", altText: null }] })]);
    expect(isValidPdf(buffer)).toBe(true);
  });

  it("skips a corrupt file with a .webp extension without throwing or crashing PDF generation", async () => {
    await mkdir(LOCAL_MEDIA_UPLOAD_DIR, { recursive: true });
    const corruptPath = path.join(LOCAL_MEDIA_UPLOAD_DIR, "pdf-service-test-corrupt.webp");
    await writeFile(corruptPath, Buffer.from("this is not a real webp file, just garbage bytes"));
    corruptFiles.push(corruptPath);

    const buffer = await renderExportCataloguePdf([product({ images: [{ url: "/media-files/pdf-service-test-corrupt.webp", altText: null }] })]);
    expect(isValidPdf(buffer)).toBe(true);
  });

  it("skips an unsupported, non-webp format (e.g. avif) without throwing, same as having no image", async () => {
    const buffer = await renderExportCataloguePdf([product({ images: [{ url: "/images/products/does-not-exist.avif", altText: null }] })]);
    expect(isValidPdf(buffer)).toBe(true);
  });

  it("never follows a path-traversal image URL outside public/ or the media-uploads dir (see resolve-local-media-path.test.ts for the direct guard test)", async () => {
    const buffer = await renderExportCataloguePdf([product({ images: [{ url: "/../../package.json", altText: null }] })]);
    expect(isValidPdf(buffer)).toBe(true);
  });
});
