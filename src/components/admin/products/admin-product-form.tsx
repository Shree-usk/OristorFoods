"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { ProductExportSpecType } from "@/generated/prisma/client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  changeAdminProductStatus,
  createAdminProduct,
  deleteAdminProduct,
  fetchAdminProduct,
  fetchProductFormReferenceData,
  updateAdminProduct,
} from "@/lib/api/admin-product-client";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { DuplicateProductDialog } from "@/components/admin/products/duplicate-product-dialog";
import { ProductBundlePanel } from "@/components/admin/products/product-bundle-panel";
import { ProductPackagingPanel } from "@/components/admin/products/product-packaging-panel";
import { ProductPricingPanel } from "@/components/admin/products/product-pricing-panel";
import { ProductVariantsPanel } from "@/components/admin/products/product-variants-panel";
import { SeoFieldsPanel } from "@/components/admin/seo/seo-fields-panel";
import { toastManager } from "@/lib/toast";
import { PRODUCT_PROMISE_ICON_OPTIONS } from "@/lib/product-promise-icons";
import { PRODUCT_EXPORT_SPEC_TYPE_LABELS, PRODUCT_EXPORT_SPEC_TYPE_ORDER } from "@/lib/product-export-spec-types";
import { productAdminSchema, type ProductAdminFormInput } from "@/validation/product-admin.schema";

const NEXT_STATUSES: Record<string, string[]> = {
  Draft: ["Published", "Archived"],
  Published: ["Archived"],
  Archived: ["Draft", "Published"],
};

const PRODUCT_TYPES = ["Standard", "Bundle", "GiftPack", "Seasonal", "LimitedEdition"] as const;

const TAB_ORDER = ["general", "nutrition", "media", "rewards", "export", "story"] as const;
const TAB_LABELS: Record<(typeof TAB_ORDER)[number], string> = {
  general: "General",
  nutrition: "Nutrition & Ingredients",
  media: "Media",
  rewards: "Rewards & Stock",
  export: "Export & Wholesale",
  story: "Product Story & Export Specifications",
};
/**
 * Every top-level productAdminSchema key that has a UI field, mapped to the
 * tab it lives on. Without this, a validation failure on a field whose tab
 * isn't the active one is completely invisible — handleSubmit's onValid
 * callback is simply never called, with no error, no toast, nothing (the
 * exact bug reported against the Media tab's image URLs: Save silently did
 * nothing). Pricing and SEO aren't here because they're separate panels
 * with their own save/validation, not part of this form's schema.
 */
const TAB_BY_FIELD: Record<string, (typeof TAB_ORDER)[number]> = {
  name: "general",
  slug: "general",
  sku: "general",
  barcode: "general",
  shortDescription: "general",
  story: "general",
  productType: "general",
  isFeatured: "general",
  brandId: "general",
  categoryIds: "general",
  collectionIds: "general",
  nutrition: "nutrition",
  ingredients: "nutrition",
  allergenIds: "nutrition",
  certificationIds: "nutrition",
  benefits: "nutrition",
  servingSuggestions: "nutrition",
  images: "media",
  videos: "media",
  inspirationCards: "media",
  featuredItems: "media",
  rewardPoints: "rewards",
  inStock: "rewards",
  stockQuantity: "rewards",
  weightGrams: "rewards",
  isExportEnabled: "export",
  exportDescription: "export",
  isExportFeatured: "export",
  exportDisplayOrder: "export",
  promiseSectionEnabled: "story",
  promiseSectionHeading: "story",
  promiseAttributes: "story",
  preparationSectionEnabled: "story",
  preparationSectionHeading: "story",
  preparationSectionSubtitle: "story",
  preparationStages: "story",
  exportSpecSectionEnabled: "story",
  exportSpecSectionHeading: "story",
  exportSpecItems: "story",
  showStorySectionsOnStandardPdp: "story",
};

const EMPTY_VALUES: ProductAdminFormInput = {
  name: "",
  slug: "",
  sku: "",
  barcode: "",
  shortDescription: "",
  story: "",
  productType: "Standard",
  isFeatured: false,
  isExportEnabled: false,
  exportDescription: "",
  isExportFeatured: false,
  exportDisplayOrder: 0,
  brandId: undefined,
  categoryIds: [],
  collectionIds: [],
  benefits: [],
  servingSuggestions: [],
  rewardPoints: 0,
  inStock: true,
  stockQuantity: 0,
  weightGrams: undefined,
  images: [],
  videos: [],
  nutrition: {
    servingSize: "",
    calories: 0,
    protein: 0,
    fat: 0,
    saturatedFat: 0,
    carbohydrates: 0,
    sugar: 0,
    fibre: 0,
    sodium: 0,
  },
  ingredients: [],
  inspirationCards: [],
  featuredItems: [],
  promiseSectionEnabled: true,
  promiseSectionHeading: "",
  promiseAttributes: [],
  preparationSectionEnabled: true,
  preparationSectionHeading: "",
  preparationSectionSubtitle: "",
  preparationStages: [],
  exportSpecSectionEnabled: true,
  exportSpecSectionHeading: "",
  exportSpecItems: [],
  showStorySectionsOnStandardPdp: false,
  allergenIds: [],
  certificationIds: [],
};

/** STORY-040. New vs. edit via an optional productId — both share this one form. */
export function AdminProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ kind: "image" | "video" | "inspirationCard" | "featuredItem"; index: number } | null>(null);
  // Separate from pickerTarget above (not just another `kind`) — that
  // dialog instance lives inside the "media" TabsContent, which Base UI
  // Tabs unmounts while inactive, so a trigger on the "story" tab needs its
  // own dialog instance there instead; see the "story" TabsContent below.
  const [storyPickerTarget, setStoryPickerTarget] = useState<{ kind: "promiseAttributeIcon" | "preparationStage"; index: number } | null>(null);
  // Controlled (not Tabs' own uncontrolled internal state) so it survives
  // opening AssetPickerDialog without reverting to the first tab —
  // uncontrolled state in a third-party component isn't reliably
  // preserved across a dev-mode Fast Refresh, which the picker's first
  // hit of a not-yet-compiled API route can trigger.
  const [activeTab, setActiveTab] = useState("general");

  const { data: referenceData } = useQuery({
    queryKey: ["admin-products-reference-data"],
    queryFn: fetchProductFormReferenceData,
  });

  const {
    data: existingProduct,
    isLoading: isLoadingProduct,
    isError: isProductError,
    error: productError,
    refetch: refetchProduct,
  } = useQuery({
    queryKey: ["admin-product", productId],
    queryFn: () => fetchAdminProduct(productId!),
    enabled: Boolean(productId),
    // This query only ever seeds the form (see the reset() effect below,
    // guarded to run once per product) or refreshes the read-only status
    // Badge after an explicit action (publish/archive/delete, each calling
    // invalidateQueries itself). A background refetch — e.g. TanStack
    // Query's default refetchOnWindowFocus, which opening/closing a
    // portal-rendered Dialog like AssetPickerDialog can trigger just by
    // moving window focus — must never race an in-progress form edit.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // A failed fetch (permission mismatch, transient 5xx, etc.) must never
    // be silently indistinguishable from "new product" — without a retry,
    // reset() below simply never fires and the form stays at EMPTY_VALUES
    // forever with zero visible signal. See the isProductError branch below.
    retry: 1,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<ProductAdminFormInput>({ resolver: zodResolver(productAdminSchema), defaultValues: EMPTY_VALUES });

  // Seeds the form exactly once per product — a background refetch of
  // `existingProduct` (TanStack Query's default refetchOnWindowFocus,
  // which a portal-rendered Dialog like AssetPickerDialog/
  // DuplicateProductDialog can trigger just by stealing and returning
  // window focus) must never silently reset in-progress, unsaved edits.
  // `initializedProductId` tracks which product this form instance has
  // already seeded; a real navigation to a different product still resets.
  const initializedProductId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!existingProduct) return;
    if (initializedProductId.current === existingProduct.id) return;
    initializedProductId.current = existingProduct.id;
    reset({
      name: existingProduct.name,
      slug: existingProduct.slug,
      sku: existingProduct.sku,
      barcode: existingProduct.barcode ?? "",
      shortDescription: existingProduct.shortDescription ?? "",
      story: existingProduct.story ?? "",
      productType: existingProduct.productType,
      isFeatured: existingProduct.isFeatured,
      isExportEnabled: existingProduct.isExportEnabled,
      exportDescription: existingProduct.exportDescription ?? "",
      isExportFeatured: existingProduct.isExportFeatured,
      exportDisplayOrder: existingProduct.exportDisplayOrder,
      brandId: existingProduct.brand?.id,
      categoryIds: existingProduct.categories.map((c: { id: string }) => c.id),
      collectionIds: existingProduct.collections.map((c: { id: string }) => c.id),
      benefits: existingProduct.benefits,
      servingSuggestions: existingProduct.servingSuggestions,
      rewardPoints: existingProduct.rewardPoints,
      inStock: existingProduct.inStock,
      stockQuantity: existingProduct.stockQuantity,
      weightGrams: existingProduct.weightGrams ?? undefined,
      images: existingProduct.images.map((image: { url: string; altText: string | null; isPrimary: boolean; sortOrder: number; mediaRole: string }) => ({
        url: image.url,
        altText: image.altText ?? "",
        isPrimary: image.isPrimary,
        sortOrder: image.sortOrder,
        mediaRole: image.mediaRole,
      })),
      videos: existingProduct.videos.map((video: { url: string; altText: string | null; isPrimary: boolean; sortOrder: number }) => ({
        url: video.url,
        altText: video.altText ?? "",
        isPrimary: video.isPrimary,
        sortOrder: video.sortOrder,
      })),
      nutrition: existingProduct.nutrition
        ? {
            servingSize: existingProduct.nutrition.servingSize,
            calories: Number(existingProduct.nutrition.calories),
            protein: Number(existingProduct.nutrition.protein),
            fat: Number(existingProduct.nutrition.fat),
            saturatedFat: Number(existingProduct.nutrition.saturatedFat),
            carbohydrates: Number(existingProduct.nutrition.carbohydrates),
            sugar: Number(existingProduct.nutrition.sugar),
            fibre: Number(existingProduct.nutrition.fibre),
            sodium: Number(existingProduct.nutrition.sodium),
          }
        : EMPTY_VALUES.nutrition,
      ingredients: existingProduct.ingredients.map((ingredient: { name: string; isAllergen: boolean; sortOrder: number }) => ingredient),
      inspirationCards: existingProduct.inspirationCards.map(
        (card: { imageUrl: string; imageAlt: string | null; title: string; description: string | null; sortOrder: number }) => ({
          imageUrl: card.imageUrl,
          imageAlt: card.imageAlt ?? "",
          title: card.title,
          description: card.description ?? "",
          sortOrder: card.sortOrder,
        }),
      ),
      featuredItems: existingProduct.featuredItems.map(
        (item: { imageUrl: string; imageAlt: string | null; title: string; description: string | null; sortOrder: number }) => ({
          imageUrl: item.imageUrl,
          imageAlt: item.imageAlt ?? "",
          title: item.title,
          description: item.description ?? "",
          sortOrder: item.sortOrder,
        }),
      ),
      promiseSectionEnabled: existingProduct.promiseSectionEnabled,
      promiseSectionHeading: existingProduct.promiseSectionHeading ?? "",
      promiseAttributes: existingProduct.promiseAttributes.map(
        (attribute: { icon: string; iconImageUrl: string | null; heading: string; description: string | null; visible: boolean; sortOrder: number }) => ({
          icon: attribute.icon,
          iconImageUrl: attribute.iconImageUrl ?? "",
          heading: attribute.heading,
          description: attribute.description ?? "",
          visible: attribute.visible,
          sortOrder: attribute.sortOrder,
        }),
      ),
      preparationSectionEnabled: existingProduct.preparationSectionEnabled,
      preparationSectionHeading: existingProduct.preparationSectionHeading ?? "",
      preparationSectionSubtitle: existingProduct.preparationSectionSubtitle ?? "",
      preparationStages: existingProduct.preparationStages.map(
        (stage: { stageNumber: string; heading: string; description: string | null; imageUrl: string; imageAlt: string | null; visible: boolean; sortOrder: number }) => ({
          stageNumber: stage.stageNumber,
          heading: stage.heading,
          description: stage.description ?? "",
          imageUrl: stage.imageUrl,
          imageAlt: stage.imageAlt ?? "",
          visible: stage.visible,
          sortOrder: stage.sortOrder,
        }),
      ),
      exportSpecSectionEnabled: existingProduct.exportSpecSectionEnabled,
      exportSpecSectionHeading: existingProduct.exportSpecSectionHeading ?? "",
      exportSpecItems: existingProduct.exportSpecItems.map(
        (item: { specType: ProductExportSpecType; value: string; visible: boolean; sortOrder: number }) => ({
          specType: item.specType,
          value: item.value,
          visible: item.visible,
          sortOrder: item.sortOrder,
        }),
      ),
      showStorySectionsOnStandardPdp: existingProduct.showStorySectionsOnStandardPdp,
      allergenIds: existingProduct.allergens.map((allergen: { id: string }) => allergen.id),
      certificationIds: existingProduct.certifications.map((certification: { id: string }) => certification.id),
    });
  }, [existingProduct, reset]);

  const images = useFieldArray({ control, name: "images" });
  const videos = useFieldArray({ control, name: "videos" });
  const ingredients = useFieldArray({ control, name: "ingredients" });
  const inspirationCards = useFieldArray({ control, name: "inspirationCards" });
  const featuredItems = useFieldArray({ control, name: "featuredItems" });
  const promiseAttributes = useFieldArray({ control, name: "promiseAttributes" });
  const preparationStages = useFieldArray({ control, name: "preparationStages" });
  const exportSpecItems = useFieldArray({ control, name: "exportSpecItems" });

  const categoryIds = watch("categoryIds") ?? [];
  const collectionIds = watch("collectionIds") ?? [];
  const allergenIds = watch("allergenIds") ?? [];
  const certificationIds = watch("certificationIds") ?? [];

  const submit = handleSubmit(
    async (values) => {
      setServerError(null);
      try {
        if (productId) {
          await updateAdminProduct(productId, values);
          toastManager.add({ title: "Product saved" });
        } else {
          const created = await createAdminProduct(values);
          toastManager.add({ title: "Product saved" });
          router.push(`/admin/products/${created.id}`);
          return;
        }
      } catch {
        setServerError("Something went wrong. Please try again.");
      }
    },
    (invalidFields) => {
      // Jumps to the first tab with a problem — a validation error on a tab
      // the admin isn't currently looking at is otherwise never seen (see
      // TAB_BY_FIELD's comment).
      const firstErrorTab = TAB_ORDER.find((tab) => Object.keys(invalidFields).some((key) => TAB_BY_FIELD[key] === tab));
      if (firstErrorTab) setActiveTab(firstErrorTab);
    },
  );

  const errorTabs = Array.from(new Set(Object.keys(errors).map((key) => TAB_BY_FIELD[key]).filter(Boolean))) as (typeof TAB_ORDER)[number][];

  function toggleId(current: string[], id: string): string[] {
    return current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
  }

  const status: string | undefined = existingProduct?.status;

  async function handleStatusChange(nextStatus: string) {
    await changeAdminProductStatus(productId!, nextStatus);
    queryClient.invalidateQueries({ queryKey: ["admin-product", productId] });
  }

  async function handleDelete() {
    await deleteAdminProduct(productId!);
    router.push("/admin/products");
  }

  // A failed/still-pending fetch for an EXISTING product must never render
  // as a blank, saveable form — that silently looks like a fresh/empty
  // product and invites an admin to overwrite real saved data with
  // EMPTY_VALUES. New-product mode (no productId, query disabled) is
  // unaffected — isLoadingProduct/isProductError are both false there.
  if (productId && isLoadingProduct) {
    return <p className="text-body text-charcoal/70">Loading product…</p>;
  }
  if (productId && isProductError) {
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
        <p className="text-body text-destructive">Failed to load this product: {productError instanceof Error ? productError.message : "Unknown error"}</p>
        <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => refetchProduct()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-h2 font-heading text-charcoal">{productId ? "Edit product" : "New product"}</h1>
          {status && <Badge variant={status === "Published" ? "default" : status === "Archived" ? "secondary" : "outline"}>{status}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {productId && status && (
            <>
              {(NEXT_STATUSES[status] ?? []).map((next) => (
                <Button key={next} type="button" variant="outline" size="sm" onClick={() => handleStatusChange(next)}>
                  {next === "Published" ? "Publish" : next === "Archived" ? "Archive" : "Move to Draft"}
                </Button>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setDuplicateOpen(true)}>
                Duplicate
              </Button>
              <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                Delete
              </Button>
            </>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {serverError && <p className="mt-2 text-small text-destructive">{serverError}</p>}
      {errorTabs.length > 0 && (
        <p className="mt-2 text-small text-destructive">
          Save was blocked by a validation error — check: {errorTabs.map((tab) => TAB_LABELS[tab]).join(", ")}.
        </p>
      )}
      {productId && <DuplicateProductDialog productId={productId} open={duplicateOpen} onOpenChange={setDuplicateOpen} />}

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="mt-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="pricing">Pricing</TabsTrigger>
          <TabsTrigger value="variants">Variants</TabsTrigger>
          <TabsTrigger value="bundle">Bundle</TabsTrigger>
          <TabsTrigger value="packaging">Packaging</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition &amp; Ingredients</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="rewards">Rewards &amp; Stock</TabsTrigger>
          <TabsTrigger value="export">Export &amp; Wholesale</TabsTrigger>
          <TabsTrigger value="story">Product Story &amp; Export Specs</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="product-name">Name</Label>
            <Input id="product-name" {...register("name")} />
            {errors.name && <p className="mt-1 text-small text-destructive">{errors.name.message}</p>}
          </div>
          <div>
            <Label htmlFor="product-slug">Slug</Label>
            <Input id="product-slug" {...register("slug")} />
            {errors.slug && <p className="mt-1 text-small text-destructive">{errors.slug.message}</p>}
          </div>
          <div>
            <Label htmlFor="product-sku">SKU</Label>
            <Input id="product-sku" {...register("sku")} />
            {errors.sku && <p className="mt-1 text-small text-destructive">{errors.sku.message}</p>}
          </div>
          <div>
            <Label htmlFor="product-barcode">Barcode</Label>
            <Input id="product-barcode" {...register("barcode")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="product-short-description">Short description</Label>
            <Textarea id="product-short-description" {...register("shortDescription")} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="product-story">Product story</Label>
            <Textarea id="product-story" rows={6} {...register("story")} />
          </div>
          <div>
            <Label htmlFor="product-type">Product type</Label>
            <Controller
              control={control}
              name="productType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="product-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="pt-6">
            <Controller
              control={control}
              name="isFeatured"
              render={({ field }) => (
                <CheckboxOption
                  label="Featured product"
                  checked={field.value ?? false}
                  onCheckedChange={field.onChange}
                />
              )}
            />
            <p className="mt-1 text-caption text-charcoal/60">Shown in the &quot;Featured Products&quot; rail on other products&apos; pages.</p>
          </div>
          <div>
            <Label htmlFor="product-brand">Brand</Label>
            <Controller
              control={control}
              name="brandId"
              render={({ field }) => (
                <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                  <SelectTrigger id="product-brand" className="w-full">
                    <SelectValue>{(selected: string | null) => (referenceData?.brands ?? []).find((brand) => brand.id === selected)?.name ?? "No brand"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(referenceData?.brands ?? []).map((brand) => (
                      <SelectItem key={brand.id} value={brand.id}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Categories</Label>
            {errors.categoryIds && <p className="text-small text-destructive">{errors.categoryIds.message}</p>}
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-input p-2 sm:grid-cols-3">
              {(referenceData?.categories ?? []).map((category) => (
                <CheckboxOption
                  key={category.id}
                  label={category.name}
                  checked={categoryIds.includes(category.id)}
                  onCheckedChange={() => setValue("categoryIds", toggleId(categoryIds, category.id), { shouldValidate: true })}
                />
              ))}
            </div>
          </div>
          <div className="sm:col-span-2">
            <Label>Collections (optional)</Label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-input p-2 sm:grid-cols-3">
              {(referenceData?.collections ?? []).length === 0 ? (
                <p className="col-span-full text-small text-charcoal/70">
                  No active collections yet — add one in Admin &gt; Collections.
                </p>
              ) : (
                (referenceData?.collections ?? []).map((collection) => (
                  <CheckboxOption
                    key={collection.id}
                    label={collection.name}
                    checked={collectionIds.includes(collection.id)}
                    onCheckedChange={() => setValue("collectionIds", toggleId(collectionIds, collection.id), { shouldValidate: true })}
                  />
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          {productId ? (
            <ProductPricingPanel productId={productId} />
          ) : (
            <p className="text-body text-charcoal/70">Save the product first to configure pricing.</p>
          )}
        </TabsContent>

        <TabsContent value="variants" className="mt-4">
          {productId ? (
            <ProductVariantsPanel productId={productId} />
          ) : (
            <p className="text-body text-charcoal/70">Save the product first to configure variants.</p>
          )}
        </TabsContent>

        <TabsContent value="bundle" className="mt-4">
          {productId ? (
            <ProductBundlePanel productId={productId} />
          ) : (
            <p className="text-body text-charcoal/70">Save the product first to configure a bundle.</p>
          )}
        </TabsContent>

        <TabsContent value="packaging" className="mt-4">
          {productId ? (
            <ProductPackagingPanel productId={productId} />
          ) : (
            <p className="text-body text-charcoal/70">Save the product first to configure custom packaging.</p>
          )}
        </TabsContent>

        <TabsContent value="nutrition" className="mt-4 space-y-6">
          <div>
            <h2 className="text-h4 font-heading text-charcoal">Nutrition facts</h2>
            <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <Label htmlFor="nutrition-serving-size">Serving size</Label>
                <Input id="nutrition-serving-size" {...register("nutrition.servingSize")} />
                {errors.nutrition?.servingSize && <p className="mt-1 text-caption text-destructive">{errors.nutrition.servingSize.message}</p>}
              </div>
              {(["calories", "protein", "fat", "saturatedFat", "carbohydrates", "sugar", "fibre", "sodium"] as const).map((field) => (
                <div key={field}>
                  <Label htmlFor={`nutrition-${field}`}>{field}</Label>
                  <Input id={`nutrition-${field}`} type="number" step="0.01" {...register(`nutrition.${field}`, { valueAsNumber: true })} />
                  {errors.nutrition?.[field] && <p className="mt-1 text-caption text-destructive">{errors.nutrition[field]?.message}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Ingredients</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => ingredients.append({ name: "", isAllergen: false, sortOrder: ingredients.fields.length })}>
                Add ingredient
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {ingredients.fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2">
                  <Input {...register(`ingredients.${index}.name`)} placeholder="Ingredient name" />
                  <Controller
                    control={control}
                    name={`ingredients.${index}.isAllergen`}
                    render={({ field }) => <CheckboxOption label="Allergen" checked={field.value ?? false} onCheckedChange={field.onChange} />}
                  />
                  <Button type="button" size="sm" variant="ghost" onClick={() => ingredients.remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Allergens</Label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-input p-2 sm:grid-cols-3">
              {(referenceData?.allergens ?? []).map((allergen) => (
                <CheckboxOption
                  key={allergen.id}
                  label={allergen.name}
                  checked={allergenIds.includes(allergen.id)}
                  onCheckedChange={() => setValue("allergenIds", toggleId(allergenIds, allergen.id))}
                />
              ))}
            </div>
          </div>

          <div>
            <Label>Certifications</Label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-input p-2 sm:grid-cols-3">
              {(referenceData?.certifications ?? []).map((certification) => (
                <CheckboxOption
                  key={certification.id}
                  label={certification.name}
                  checked={certificationIds.includes(certification.id)}
                  onCheckedChange={() => setValue("certificationIds", toggleId(certificationIds, certification.id))}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-4 space-y-6">
          <p className="text-small text-charcoal/70">
            Type a URL directly, or browse the Media Library for an existing asset. Product photos are shown in a square frame
            without cropping — a roughly square image (e.g. 1200×1200px) fills the frame best; other shapes are shown in full with
            some padding either side.
          </p>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Images</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => images.append({ url: "", altText: "", isPrimary: images.fields.length === 0, sortOrder: images.fields.length })}>
                Add image
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {images.fields.map((field, index) => (
                <div key={field.id}>
                  <div className="flex items-center gap-2">
                    <Input {...register(`images.${index}.url`)} placeholder="Image URL" className="flex-1" />
                    <Input {...register(`images.${index}.altText`)} placeholder="Alt text" className="flex-1" />
                    <Controller
                      control={control}
                      name={`images.${index}.isPrimary`}
                      render={({ field }) => (
                        <CheckboxOption
                          label="Primary"
                          checked={field.value ?? false}
                          onCheckedChange={(checked) => {
                            // Exclusive, not independent — only one image can
                            // be "the" primary (it's what decides the PDP
                            // gallery's default photo and the single thumbnail
                            // used everywhere only one image fits, e.g. cart/
                            // listing cards), so checking this one unchecks
                            // every other row rather than allowing several.
                            if (checked) {
                              images.fields.forEach((_, otherIndex) => {
                                if (otherIndex !== index) setValue(`images.${otherIndex}.isPrimary`, false);
                              });
                            }
                            field.onChange(checked);
                          }}
                        />
                      )}
                    />
                    <Button type="button" size="sm" variant="outline" onClick={() => setPickerTarget({ kind: "image", index })}>
                      Browse Library
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => images.remove(index)}>
                      Remove
                    </Button>
                  </div>
                  {errors.images?.[index]?.url && <p className="mt-1 text-caption text-destructive">{errors.images[index]?.url?.message}</p>}
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Videos</h2>
              <Button type="button" size="sm" variant="outline" onClick={() => videos.append({ url: "", altText: "", isPrimary: false, sortOrder: videos.fields.length })}>
                Add video
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {videos.fields.map((field, index) => (
                <div key={field.id}>
                  <div className="flex items-center gap-2">
                    <Input {...register(`videos.${index}.url`)} placeholder="Video URL" className="flex-1" />
                    <Input {...register(`videos.${index}.altText`)} placeholder="Alt text" className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => setPickerTarget({ kind: "video", index })}>
                      Browse Library
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => videos.remove(index)}>
                      Remove
                    </Button>
                  </div>
                  {errors.videos?.[index]?.url && <p className="mt-1 text-caption text-destructive">{errors.videos[index]?.url?.message}</p>}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Inspiration cards</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  inspirationCards.append({ imageUrl: "", imageAlt: "", title: "", description: "", sortOrder: inspirationCards.fields.length })
                }
              >
                Add inspiration card
              </Button>
            </div>
            <p className="mt-1 text-caption text-charcoal/60">
              Shown on the product page under &quot;A little inspiration for your table&quot;. Images display at roughly 80×100px — a
              portrait-ish photo works best, but any shape will be cropped to fit.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {inspirationCards.fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-input p-3">
                  <div className="flex items-center gap-2">
                    <Input {...register(`inspirationCards.${index}.imageUrl`)} placeholder="Image URL" className="flex-1" />
                    <Input {...register(`inspirationCards.${index}.imageAlt`)} placeholder="Alt text" className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => setPickerTarget({ kind: "inspirationCard", index })}>
                      Browse Library
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => inspirationCards.remove(index)}>
                      Remove
                    </Button>
                  </div>
                  {errors.inspirationCards?.[index]?.imageUrl && (
                    <p className="mt-1 text-caption text-destructive">{errors.inspirationCards[index]?.imageUrl?.message}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Input {...register(`inspirationCards.${index}.title`)} placeholder="Title" className="flex-1" />
                  </div>
                  {errors.inspirationCards?.[index]?.title && (
                    <p className="mt-1 text-caption text-destructive">{errors.inspirationCards[index]?.title?.message}</p>
                  )}
                  <Textarea {...register(`inspirationCards.${index}.description`)} placeholder="Description (optional)" className="mt-2" rows={2} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Featured items</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  featuredItems.append({ imageUrl: "", imageAlt: "", title: "", description: "", sortOrder: featuredItems.fields.length })
                }
              >
                Add featured item
              </Button>
            </div>
            <p className="mt-1 text-caption text-charcoal/60">
              Shown on the product page as &quot;Items Featured in This Collection&quot;, just before &quot;Recipes Using This
              Product&quot; — up to 4 per row. Images display at roughly 300×400px (3:4 portrait) — not linked to any real product,
              just a photo, title, and description.
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {featuredItems.fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-input p-3">
                  <div className="flex items-center gap-2">
                    <Input {...register(`featuredItems.${index}.imageUrl`)} placeholder="Image URL" className="flex-1" />
                    <Input {...register(`featuredItems.${index}.imageAlt`)} placeholder="Alt text" className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => setPickerTarget({ kind: "featuredItem", index })}>
                      Browse Library
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => featuredItems.remove(index)}>
                      Remove
                    </Button>
                  </div>
                  {errors.featuredItems?.[index]?.imageUrl && (
                    <p className="mt-1 text-caption text-destructive">{errors.featuredItems[index]?.imageUrl?.message}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Input {...register(`featuredItems.${index}.title`)} placeholder="Title" className="flex-1" />
                  </div>
                  {errors.featuredItems?.[index]?.title && (
                    <p className="mt-1 text-caption text-destructive">{errors.featuredItems[index]?.title?.message}</p>
                  )}
                  <Textarea {...register(`featuredItems.${index}.description`)} placeholder="Description (optional)" className="mt-2" rows={2} />
                </div>
              ))}
            </div>
          </div>

          <AssetPickerDialog
            open={pickerTarget !== null}
            onOpenChange={(open) => {
              if (!open) setPickerTarget(null);
            }}
            onSelect={(asset) => {
              if (!pickerTarget) return;
              if (pickerTarget.kind === "inspirationCard") {
                setValue(`inspirationCards.${pickerTarget.index}.imageUrl`, asset.url);
                setValue(`inspirationCards.${pickerTarget.index}.imageAlt`, asset.altText ?? "");
              } else if (pickerTarget.kind === "featuredItem") {
                setValue(`featuredItems.${pickerTarget.index}.imageUrl`, asset.url);
                setValue(`featuredItems.${pickerTarget.index}.imageAlt`, asset.altText ?? "");
              } else {
                setValue(`${pickerTarget.kind}s.${pickerTarget.index}.url`, asset.url);
                setValue(`${pickerTarget.kind}s.${pickerTarget.index}.altText`, asset.altText ?? "");
              }
              setPickerTarget(null);
            }}
          />
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <SeoFieldsPanel entityType="Product" entityId={productId ?? null} />
        </TabsContent>

        <TabsContent value="rewards" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="product-reward-points">Reward points</Label>
            {/* setValueAs, not valueAsNumber: an emptied number input's native
                valueAsNumber is NaN, not 0 — z.number() rejects NaN even
                though this field is schema-optional, blocking Save with a
                vague "check: Rewards & Stock" and no visible inline reason.
                A blank field means "no points", i.e. 0, not invalid. */}
            <Input id="product-reward-points" type="number" {...register("rewardPoints", { setValueAs: (value) => (value === "" ? 0 : Number(value)) })} />
          </div>
          <div>
            <Label htmlFor="product-stock-quantity">Stock quantity</Label>
            <Input id="product-stock-quantity" type="number" {...register("stockQuantity", { setValueAs: (value) => (value === "" ? 0 : Number(value)) })} />
          </div>
          <div>
            <Label htmlFor="product-weight">Weight (grams)</Label>
            <Input id="product-weight" type="number" {...register("weightGrams", { setValueAs: (value) => (value === "" ? undefined : Number(value)) })} />
          </div>
          <div className="pt-6">
            <Controller
              control={control}
              name="inStock"
              render={({ field }) => <CheckboxOption label="In stock" checked={field.value ?? true} onCheckedChange={field.onChange} />}
            />
          </div>
        </TabsContent>

        <TabsContent value="export" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 pt-1">
            <Controller
              control={control}
              name="isExportEnabled"
              render={({ field }) => <CheckboxOption label="Enable for Export & Wholesale catalogue" checked={field.value ?? false} onCheckedChange={field.onChange} />}
            />
            <p className="mt-1 text-caption text-charcoal/60">
              Shows this product on the public /export catalogue — never affects its retail visibility on /products.
            </p>
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="product-export-description">Export description (optional)</Label>
            <Textarea id="product-export-description" rows={4} {...register("exportDescription")} />
            <p className="mt-1 text-caption text-charcoal/60">
              Shown on the export catalogue and in the generated PDF instead of the retail short description, when set.
            </p>
          </div>
          <div className="pt-6">
            <Controller
              control={control}
              name="isExportFeatured"
              render={({ field }) => <CheckboxOption label="Featured on export catalogue" checked={field.value ?? false} onCheckedChange={field.onChange} />}
            />
            <p className="mt-1 text-caption text-charcoal/60">Distinct from the general &quot;Featured product&quot; flag above.</p>
          </div>
          <div>
            <Label htmlFor="product-export-order">Export display order</Label>
            <Input id="product-export-order" type="number" {...register("exportDisplayOrder", { setValueAs: (value) => (value === "" ? 0 : Number(value)) })} />
            <p className="mt-1 text-caption text-charcoal/60">Lower numbers appear first among featured export products.</p>
          </div>
        </TabsContent>

        <TabsContent value="story" className="mt-4 space-y-8">
          <p className="text-small text-charcoal/70">
            These three sections always appear on the Export Catalogue page (/export/catalogue) when enabled with content below.
            Showing them on the standard product page is a separate, optional choice — see the checkbox at the bottom.
          </p>

          {/* Product Promise */}
          <div>
            <Controller
              control={control}
              name="promiseSectionEnabled"
              render={({ field }) => <CheckboxOption label="Enable &quot;Good Food. Thoughtfully Made.&quot;" checked={field.value ?? true} onCheckedChange={field.onChange} />}
            />
            <div className="mt-2">
              <Label htmlFor="promise-section-heading">Section heading</Label>
              <Input id="promise-section-heading" placeholder="Good Food. Thoughtfully Made." {...register("promiseSectionHeading")} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Promise attributes</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  promiseAttributes.append({ icon: "Leaf", iconImageUrl: "", heading: "", description: "", visible: true, sortOrder: promiseAttributes.fields.length })
                }
              >
                Add promise attribute
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {promiseAttributes.fields.map((field, index) => {
                return (
                  <div key={field.id} className="rounded-lg border border-input p-3">
                    <div className="flex items-center gap-2">
                      <Controller
                        control={control}
                        name={`promiseAttributes.${index}.icon`}
                        render={({ field: iconField }) => {
                          const IconPreview = PRODUCT_PROMISE_ICON_OPTIONS[iconField.value ?? ""];
                          return (
                            <Select value={iconField.value} onValueChange={iconField.onChange}>
                              <SelectTrigger className="w-44 shrink-0">
                                <SelectValue>{() => (
                                  <span className="flex items-center gap-1.5">
                                    {IconPreview && <IconPreview className="size-4" aria-hidden="true" />}
                                    {iconField.value}
                                  </span>
                                )}</SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(PRODUCT_PROMISE_ICON_OPTIONS).map(([key, Icon]) => (
                                  <SelectItem key={key} value={key}>
                                    <span className="flex items-center gap-1.5">
                                      <Icon className="size-4" aria-hidden="true" />
                                      {key}
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          );
                        }}
                      />
                      <Input {...register(`promiseAttributes.${index}.iconImageUrl`)} placeholder="Custom icon image URL (optional)" className="flex-1" />
                      <Button type="button" size="sm" variant="outline" onClick={() => setStoryPickerTarget({ kind: "promiseAttributeIcon", index })}>
                        Browse Library
                      </Button>
                      <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => promiseAttributes.move(index, index - 1)}>
                        Up
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={index === promiseAttributes.fields.length - 1}
                        onClick={() => promiseAttributes.move(index, index + 1)}
                      >
                        Down
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={() => promiseAttributes.remove(index)}>
                        Remove
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input {...register(`promiseAttributes.${index}.heading`)} placeholder="Heading (e.g. No Artificial Preservatives)" className="flex-1" />
                      <Controller
                        control={control}
                        name={`promiseAttributes.${index}.visible`}
                        render={({ field: visibleField }) => (
                          <CheckboxOption label="Visible" checked={visibleField.value ?? true} onCheckedChange={visibleField.onChange} />
                        )}
                      />
                    </div>
                    {errors.promiseAttributes?.[index]?.heading && (
                      <p className="mt-1 text-caption text-destructive">{errors.promiseAttributes[index]?.heading?.message}</p>
                    )}
                    <Textarea {...register(`promiseAttributes.${index}.description`)} placeholder="Supporting description (optional)" className="mt-2" rows={2} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Preparation Story */}
          <div>
            <Controller
              control={control}
              name="preparationSectionEnabled"
              render={({ field }) => <CheckboxOption label="Enable &quot;Crafted with Care. Packed with Flavour.&quot;" checked={field.value ?? true} onCheckedChange={field.onChange} />}
            />
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div>
                <Label htmlFor="preparation-section-heading">Section heading</Label>
                <Input id="preparation-section-heading" placeholder="Crafted with Care. Packed with Flavour." {...register("preparationSectionHeading")} />
              </div>
              <div>
                <Label htmlFor="preparation-section-subtitle">Section subtitle (optional)</Label>
                <Input id="preparation-section-subtitle" {...register("preparationSectionSubtitle")} />
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Preparation stages</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  preparationStages.append({
                    stageNumber: String(preparationStages.fields.length + 1).padStart(2, "0"),
                    heading: "",
                    description: "",
                    imageUrl: "",
                    imageAlt: "",
                    visible: true,
                    sortOrder: preparationStages.fields.length,
                  })
                }
              >
                Add preparation stage
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {preparationStages.fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border border-input p-3">
                  <div className="flex items-center gap-2">
                    <Input {...register(`preparationStages.${index}.stageNumber`)} placeholder="01" className="w-16 shrink-0" />
                    <Input {...register(`preparationStages.${index}.imageUrl`)} placeholder="Image URL" className="flex-1" />
                    <Input {...register(`preparationStages.${index}.imageAlt`)} placeholder="Alt text" className="flex-1" />
                    <Button type="button" size="sm" variant="outline" onClick={() => setStoryPickerTarget({ kind: "preparationStage", index })}>
                      Browse Library
                    </Button>
                    <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => preparationStages.move(index, index - 1)}>
                      Up
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={index === preparationStages.fields.length - 1}
                      onClick={() => preparationStages.move(index, index + 1)}
                    >
                      Down
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => preparationStages.remove(index)}>
                      Remove
                    </Button>
                  </div>
                  {errors.preparationStages?.[index]?.imageUrl && (
                    <p className="mt-1 text-caption text-destructive">{errors.preparationStages[index]?.imageUrl?.message}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Input {...register(`preparationStages.${index}.heading`)} placeholder="Heading (e.g. Carefully Selected)" className="flex-1" />
                    <Controller
                      control={control}
                      name={`preparationStages.${index}.visible`}
                      render={({ field: visibleField }) => (
                        <CheckboxOption label="Visible" checked={visibleField.value ?? true} onCheckedChange={visibleField.onChange} />
                      )}
                    />
                  </div>
                  {errors.preparationStages?.[index]?.heading && (
                    <p className="mt-1 text-caption text-destructive">{errors.preparationStages[index]?.heading?.message}</p>
                  )}
                  <Textarea {...register(`preparationStages.${index}.description`)} placeholder="Description (optional)" className="mt-2" rows={2} />
                </div>
              ))}
            </div>
          </div>

          {/* Packaging & Export Details */}
          <div>
            <Controller
              control={control}
              name="exportSpecSectionEnabled"
              render={({ field }) => <CheckboxOption label="Enable &quot;Packaging &amp; Export Details&quot;" checked={field.value ?? true} onCheckedChange={field.onChange} />}
            />
            <div className="mt-2">
              <Label htmlFor="export-spec-section-heading">Section heading</Label>
              <Input id="export-spec-section-heading" placeholder="Packaging & Export Details" {...register("exportSpecSectionHeading")} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <h2 className="text-h4 font-heading text-charcoal">Specification items</h2>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={exportSpecItems.fields.length >= PRODUCT_EXPORT_SPEC_TYPE_ORDER.length}
                onClick={() => {
                  const usedTypes = new Set((watch("exportSpecItems") ?? []).map((item) => item.specType));
                  const nextType = PRODUCT_EXPORT_SPEC_TYPE_ORDER.find((type) => !usedTypes.has(type));
                  if (!nextType) return;
                  exportSpecItems.append({ specType: nextType, value: "", visible: true, sortOrder: exportSpecItems.fields.length });
                }}
              >
                Add spec item
              </Button>
            </div>
            <div className="mt-2 flex flex-col gap-2">
              {exportSpecItems.fields.map((field, index) => (
                <div key={field.id} className="flex items-center gap-2 rounded-lg border border-input p-3">
                  <Controller
                    control={control}
                    name={`exportSpecItems.${index}.specType`}
                    render={({ field: typeField }) => (
                      <Select value={typeField.value} onValueChange={typeField.onChange}>
                        <SelectTrigger className="w-48 shrink-0">
                          <SelectValue>{(selected: string) => PRODUCT_EXPORT_SPEC_TYPE_LABELS[selected as keyof typeof PRODUCT_EXPORT_SPEC_TYPE_LABELS]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {PRODUCT_EXPORT_SPEC_TYPE_ORDER.map((type) => (
                            <SelectItem key={type} value={type}>
                              {PRODUCT_EXPORT_SPEC_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <div className="flex-1">
                    <Input {...register(`exportSpecItems.${index}.value`)} placeholder="e.g. 200 g | 350 g" />
                    {errors.exportSpecItems?.[index]?.value && <p className="mt-1 text-caption text-destructive">{errors.exportSpecItems[index]?.value?.message}</p>}
                  </div>
                  <Controller
                    control={control}
                    name={`exportSpecItems.${index}.visible`}
                    render={({ field: visibleField }) => <CheckboxOption label="Visible" checked={visibleField.value ?? true} onCheckedChange={visibleField.onChange} />}
                  />
                  <Button type="button" size="sm" variant="ghost" disabled={index === 0} onClick={() => exportSpecItems.move(index, index - 1)}>
                    Up
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={index === exportSpecItems.fields.length - 1}
                    onClick={() => exportSpecItems.move(index, index + 1)}
                  >
                    Down
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => exportSpecItems.remove(index)}>
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-input p-3">
            <Controller
              control={control}
              name="showStorySectionsOnStandardPdp"
              render={({ field }) => (
                <CheckboxOption label="Also show these sections on the standard Product Detail Page" checked={field.value ?? false} onCheckedChange={field.onChange} />
              )}
            />
            <p className="mt-1 text-caption text-charcoal/60">
              Off by default. The Export Catalogue page always shows enabled sections with content above — this is an additional,
              optional surface on the regular product page.
            </p>
          </div>

          <AssetPickerDialog
            open={storyPickerTarget !== null}
            onOpenChange={(open) => {
              if (!open) setStoryPickerTarget(null);
            }}
            onSelect={(asset) => {
              if (!storyPickerTarget) return;
              if (storyPickerTarget.kind === "promiseAttributeIcon") {
                setValue(`promiseAttributes.${storyPickerTarget.index}.iconImageUrl`, asset.url);
              } else {
                setValue(`preparationStages.${storyPickerTarget.index}.imageUrl`, asset.url);
                setValue(`preparationStages.${storyPickerTarget.index}.imageAlt`, asset.altText ?? "");
              }
              setStoryPickerTarget(null);
            }}
          />
        </TabsContent>
      </Tabs>
    </form>
  );
}
