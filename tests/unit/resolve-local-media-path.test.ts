// @vitest-environment node
import { describe, expect, it } from "vitest";

import { readLocalMediaFile } from "@/lib/resolve-local-media-path";

describe("resolve-local-media-path.readLocalMediaFile", () => {
  it("reads a real file under public/", async () => {
    const data = await readLocalMediaFile("/images/products/export/chicken-masala.png");
    expect(data).not.toBeNull();
    expect((data as Buffer).length).toBeGreaterThan(0);
  });

  it("returns null for a missing file", async () => {
    expect(await readLocalMediaFile("/images/products/does-not-exist.png")).toBeNull();
  });

  it("refuses a path-traversal attempt escaping public/ (admin-authored Media Library URL, not a trusted constant)", async () => {
    expect(await readLocalMediaFile("/../../package.json")).toBeNull();
    expect(await readLocalMediaFile("/../../.env")).toBeNull();
  });

  it("refuses a path-traversal attempt escaping the media-uploads dir", async () => {
    expect(await readLocalMediaFile("/media-files/../../package.json")).toBeNull();
  });
});
