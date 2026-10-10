"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
import { ProductPricingPanel } from "@/components/admin/products/product-pricing-panel";
import { SeoFieldsPanel } from "@/components/admin/seo/seo-fields-panel";
import { toastManager } from "@/lib/toast";
import { productAdminSchema, type ProductAdminFormInput } from "@/validation/product-admin.schema";

const NEXT_STATUSES: Record<string, string[]> = {
  Draft: ["Published", "Archived"],
  Published: ["Archived"],
  Archived: ["Draft", "Published"],
};

const PRODUCT_TYPES = ["Standard", "Bundle", "GiftPack", "Seasonal", "LimitedEdition"] as const;

const TAB_ORDER = ["general", "nutrition", "media", "rewards"] as const;
const TAB_LABELS: Record<(typeof TAB_ORDER)[number], string> = {
  general: "General",
  nutrition: "Nutrition & Ingredients",
  media: "Media",
  rewards: "Rewards & Stock",
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
  rewardPoints: "rewards",
  inStock: "rewards",
  stockQuantity: "rewards",
  weightGrams: "rewards",
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
  allergenIds: [],
  certificationIds: [],
};

/** STORY-040. New vs. edit via an optional productId — both share this one form. */
export function AdminProductForm({ productId }: { productId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [duplicateOpen, setDuplicateOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{ kind: "image" | "video"; index: number } | null>(null);
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

  const { data: existingProduct } = useQuery({
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
      allergenIds: existingProduct.allergens.map((allergen: { id: string }) => allergen.id),
      certificationIds: existingProduct.certifications.map((certification: { id: string }) => certification.id),
    });
  }, [existingProduct, reset]);

  const images = useFieldArray({ control, name: "images" });
  const videos = useFieldArray({ control, name: "videos" });
  const ingredients = useFieldArray({ control, name: "ingredients" });

  const categoryIds = watch("categoryIds") ?? [];
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
          <TabsTrigger value="nutrition">Nutrition &amp; Ingredients</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
          <TabsTrigger value="rewards">Rewards &amp; Stock</TabsTrigger>
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
        </TabsContent>

        <TabsContent value="pricing" className="mt-4">
          {productId ? (
            <ProductPricingPanel productId={productId} />
          ) : (
            <p className="text-body text-charcoal/70">Save the product first to configure pricing.</p>
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
                      render={({ field }) => <CheckboxOption label="Primary" checked={field.value ?? false} onCheckedChange={field.onChange} />}
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

          <AssetPickerDialog
            open={pickerTarget !== null}
            onOpenChange={(open) => {
              if (!open) setPickerTarget(null);
            }}
            onSelect={(asset) => {
              if (!pickerTarget) return;
              setValue(`${pickerTarget.kind}s.${pickerTarget.index}.url`, asset.url);
              setValue(`${pickerTarget.kind}s.${pickerTarget.index}.altText`, asset.altText ?? "");
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
            <Input id="product-reward-points" type="number" {...register("rewardPoints", { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="product-stock-quantity">Stock quantity</Label>
            <Input id="product-stock-quantity" type="number" {...register("stockQuantity", { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="product-weight">Weight (grams)</Label>
            <Input id="product-weight" type="number" {...register("weightGrams", { valueAsNumber: true })} />
          </div>
          <div className="pt-6">
            <Controller
              control={control}
              name="inStock"
              render={({ field }) => <CheckboxOption label="In stock" checked={field.value ?? true} onCheckedChange={field.onChange} />}
            />
          </div>
        </TabsContent>
      </Tabs>
    </form>
  );
}
