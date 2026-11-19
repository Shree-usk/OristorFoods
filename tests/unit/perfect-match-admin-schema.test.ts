import { describe, expect, it } from "vitest";
import {
  perfectMatchPairingAdminSchema,
  perfectMatchProductAdminSchema,
  perfectMatchReorderSchema,
  perfectMatchSettingAdminSchema,
} from "@/validation/perfect-match-admin.schema";

describe("perfectMatchSettingAdminSchema", () => {
  it("normalizes a blank optional field (as the form always submits, never omits) to null", () => {
    const parsed = perfectMatchSettingAdminSchema.parse({ eyebrow: "", heading: "Ordinary Meals. Extraordinary Flavours.", description: "" });
    expect(parsed.eyebrow).toBeNull();
    expect(parsed.heading).toBe("Ordinary Meals. Extraordinary Flavours.");
    expect(parsed.description).toBeNull();
  });
});

describe("perfectMatchProductAdminSchema", () => {
  it("requires a productId", () => {
    expect(perfectMatchProductAdminSchema.safeParse({ productId: "" }).success).toBe(false);
    expect(perfectMatchProductAdminSchema.safeParse({ productId: "prod-1" }).success).toBe(true);
  });

  it("defaults isDefaultFeatured to false and normalizes blank overlay fields to null", () => {
    const parsed = perfectMatchProductAdminSchema.parse({ productId: "prod-1", kicker: "", promoDescriptionOverride: "" });
    expect(parsed.isDefaultFeatured).toBe(false);
    expect(parsed.kicker).toBeNull();
    expect(parsed.promoDescriptionOverride).toBeNull();
  });

  it("only accepts a recognized status value", () => {
    expect(perfectMatchProductAdminSchema.safeParse({ productId: "prod-1", status: "Published" }).success).toBe(true);
    expect(perfectMatchProductAdminSchema.safeParse({ productId: "prod-1", status: "not-a-real-status" }).success).toBe(false);
  });
});

describe("perfectMatchPairingAdminSchema", () => {
  it("requires title and imageUrl", () => {
    expect(perfectMatchPairingAdminSchema.safeParse({ title: "", imageUrl: "/images/rotti.webp" }).success).toBe(false);
    expect(perfectMatchPairingAdminSchema.safeParse({ title: "Sri Lankan Rotti", imageUrl: "" }).success).toBe(false);
    expect(perfectMatchPairingAdminSchema.safeParse({ title: "Sri Lankan Rotti", imageUrl: "/images/rotti.webp" }).success).toBe(true);
  });

  it("treats categoryLabel and supportingTag as two distinct, independently-blankable fields", () => {
    const parsed = perfectMatchPairingAdminSchema.parse({
      title: "Sri Lankan Rotti",
      imageUrl: "/images/rotti.webp",
      categoryLabel: "THE CLASSIC",
      supportingTag: "",
    });
    expect(parsed.categoryLabel).toBe("THE CLASSIC");
    expect(parsed.supportingTag).toBeNull();
  });
});

describe("perfectMatchReorderSchema", () => {
  it("requires at least one id", () => {
    expect(perfectMatchReorderSchema.safeParse({ orderedIds: [] }).success).toBe(false);
    expect(perfectMatchReorderSchema.safeParse({ orderedIds: ["a", "b"] }).success).toBe(true);
  });
});
