"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { FoodAcademyProductPicker } from "@/components/admin/food-academy/food-academy-product-picker";
import { FoodAcademyRecipePicker } from "@/components/admin/food-academy/food-academy-recipe-picker";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  createFoodAcademyEntry,
  deleteFoodAcademyEntry,
  fetchFoodAcademyEntry,
  fetchFoodAcademyEntryReferenceData,
  publishFoodAcademyEntry,
  unpublishFoodAcademyEntry,
  updateFoodAcademyEntry,
  type FoodAcademyContentType,
} from "@/lib/api/admin-food-academy-client";
import { toastManager } from "@/lib/toast";

const CONTENT_TYPES: FoodAcademyContentType[] = ["Article", "Guide", "Course"];

interface SectionFormValues {
  title: string;
  bodyContent: string;
  imageUrl: string;
}

interface EntryFormValues {
  slug: string;
  title: string;
  summary: string;
  heroImageUrl: string;
  contentType: FoodAcademyContentType;
  categoryId: string;
  bodyContent: string;
  readingTimeMinutes: string;
  authorName: string;
  isFeatured: boolean;
  sections: SectionFormValues[];
  recipeIds: string[];
  productIds: string[];
}

const EMPTY_VALUES: EntryFormValues = {
  slug: "",
  title: "",
  summary: "",
  heroImageUrl: "",
  contentType: "Article",
  categoryId: "",
  bodyContent: "",
  readingTimeMinutes: "",
  authorName: "",
  isFeatured: false,
  sections: [],
  recipeIds: [],
  productIds: [],
};

/** New vs. edit via an optional entryId — both share this one form, mirroring admin-recipe-form.tsx's pattern. */
export function AdminFoodAcademyEntryForm({ entryId }: { entryId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [sectionImagePickerIndex, setSectionImagePickerIndex] = useState<number | null>(null);

  const { data: referenceData } = useQuery({ queryKey: ["admin-food-academy-entry-reference-data"], queryFn: fetchFoodAcademyEntryReferenceData });

  const { data: existingEntry } = useQuery({
    queryKey: ["admin-food-academy-entry", entryId],
    queryFn: () => fetchFoodAcademyEntry(entryId!),
    enabled: Boolean(entryId),
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EntryFormValues>({ defaultValues: EMPTY_VALUES });

  const initializedEntryId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!existingEntry) return;
    if (initializedEntryId.current === existingEntry.id) return;
    initializedEntryId.current = existingEntry.id;
    reset({
      slug: existingEntry.slug,
      title: existingEntry.title,
      summary: existingEntry.summary,
      heroImageUrl: existingEntry.heroImageUrl ?? "",
      contentType: existingEntry.contentType,
      categoryId: existingEntry.categoryId,
      bodyContent: existingEntry.bodyContent ?? "",
      readingTimeMinutes: existingEntry.readingTimeMinutes ? String(existingEntry.readingTimeMinutes) : "",
      authorName: existingEntry.authorName ?? "",
      isFeatured: existingEntry.isFeatured,
      sections: existingEntry.sections.map((section) => ({ title: section.title, bodyContent: section.bodyContent, imageUrl: section.imageUrl ?? "" })),
      recipeIds: existingEntry.recipeRefs.map((ref) => ref.recipeId),
      productIds: existingEntry.productRefs.map((ref) => ref.productId),
    });
  }, [existingEntry, reset]);

  const sections = useFieldArray({ control, name: "sections" });
  const recipeIds = watch("recipeIds") ?? [];
  const productIds = watch("productIds") ?? [];
  const contentType = watch("contentType");

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    const payload = {
      slug: values.slug,
      title: values.title,
      summary: values.summary,
      heroImageUrl: values.heroImageUrl || null,
      contentType: values.contentType,
      categoryId: values.categoryId,
      bodyContent: values.bodyContent || null,
      readingTimeMinutes: values.readingTimeMinutes ? Number(values.readingTimeMinutes) : null,
      authorName: values.authorName || null,
      isFeatured: values.isFeatured,
      sections: values.sections.map((section, index) => ({
        sectionNumber: index + 1,
        title: section.title,
        bodyContent: section.bodyContent,
        imageUrl: section.imageUrl || null,
      })),
      recipeIds: values.recipeIds,
      productIds: values.productIds,
    };

    try {
      if (entryId) {
        await updateFoodAcademyEntry(entryId, payload);
        queryClient.invalidateQueries({ queryKey: ["admin-food-academy-entry", entryId] });
        toastManager.add({ title: "Entry saved" });
      } else {
        const created = await createFoodAcademyEntry(payload);
        toastManager.add({ title: "Entry saved" });
        router.push(`/admin/food-academy/entries/${created.id}`);
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  });

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      queryClient.invalidateQueries({ queryKey: ["admin-food-academy-entry", entryId] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function handleDelete() {
    if (!entryId) return;
    await deleteFoodAcademyEntry(entryId);
    router.push("/admin/food-academy/entries");
  }

  const status = existingEntry?.status;

  return (
    <form onSubmit={submit} noValidate className="max-w-3xl space-y-10 pb-16">
      <Link href="/admin/food-academy/entries" className="text-small text-muted-foreground hover:text-charcoal">
        ← Back to entries
      </Link>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-h2 font-heading text-charcoal">{entryId ? "Edit entry" : "New entry"}</h1>
          {status && <Badge variant={status === "Published" ? "default" : "secondary"}>{status}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {entryId && status === "Draft" && (
            <Button type="button" variant="outline" onClick={() => runAction(() => publishFoodAcademyEntry(entryId))}>
              Publish
            </Button>
          )}
          {entryId && status === "Published" && (
            <Button type="button" variant="outline" onClick={() => runAction(() => unpublishFoodAcademyEntry(entryId))}>
              Unpublish
            </Button>
          )}
          {entryId && (
            <Button type="button" variant="destructive" onClick={handleDelete}>
              Delete
            </Button>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save entry"}
          </Button>
        </div>
      </div>

      {actionError && <p className="text-small text-chilli">{actionError}</p>}
      {serverError && <p className="text-small text-chilli">{serverError}</p>}

      <section className="space-y-4">
        <div>
          <Label htmlFor="fa-entry-title">Title</Label>
          <Input id="fa-entry-title" {...register("title", { required: true })} maxLength={200} />
        </div>
        <div>
          <Label htmlFor="fa-entry-slug">Slug</Label>
          <Input id="fa-entry-slug" {...register("slug", { required: true })} maxLength={150} />
        </div>
        <div>
          <Label htmlFor="fa-entry-summary">Summary</Label>
          <Textarea id="fa-entry-summary" {...register("summary", { required: true })} maxLength={500} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fa-entry-content-type">Content type</Label>
            <Controller
              control={control}
              name="contentType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="fa-entry-content-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTENT_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="fa-entry-category">Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="fa-entry-category" className="w-full">
                    <SelectValue>{(selected: string | null) => (referenceData?.categories ?? []).find((category) => category.id === selected)?.name ?? "Select a category"}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {(referenceData?.categories ?? []).map((category) => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.categoryId && <p className="mt-1 text-small text-destructive">A category is required.</p>}
          </div>
        </div>
        <div>
          <Label>Hero image</Label>
          <div className="mt-1 flex items-center gap-3">
            <Input placeholder="Image URL" {...register("heroImageUrl")} />
            <Button type="button" variant="outline" onClick={() => setHeroPickerOpen(true)}>
              Browse Library
            </Button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fa-entry-reading-time">Reading time (minutes)</Label>
            <Input id="fa-entry-reading-time" type="number" min={1} {...register("readingTimeMinutes")} />
          </div>
          <div>
            <Label htmlFor="fa-entry-author">Author name</Label>
            <Input id="fa-entry-author" {...register("authorName")} maxLength={100} />
          </div>
        </div>
        <CheckboxOption label="Featured" checked={watch("isFeatured")} onCheckedChange={(checked) => setValue("isFeatured", checked)} />
      </section>

      <section className="space-y-2">
        <Label htmlFor="fa-entry-body">Body (markdown)</Label>
        <Textarea id="fa-entry-body" {...register("bodyContent")} rows={10} />
        <p className="text-caption text-charcoal/60">
          {contentType === "Course" ? "Optional short intro — a Course's real content lives in its sections below." : "Required for Article/Guide entries."}
        </p>
      </section>

      {contentType === "Course" && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 font-heading text-charcoal">Sections</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => sections.append({ title: "", bodyContent: "", imageUrl: "" })}>
              Add section
            </Button>
          </div>
          {sections.fields.length === 0 && <p className="text-small text-muted-foreground">A Course needs at least one section before it can be published.</p>}
          {sections.fields.map((field, index) => (
            <div key={field.id} className="space-y-3 rounded-md border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-small font-medium text-charcoal">Section {index + 1}</p>
                <Button type="button" size="sm" variant="ghost" onClick={() => sections.remove(index)}>
                  Remove
                </Button>
              </div>
              <div>
                <Label htmlFor={`fa-section-${index}-title`}>Title</Label>
                <Input id={`fa-section-${index}-title`} {...register(`sections.${index}.title`, { required: true })} maxLength={150} />
              </div>
              <div>
                <Label htmlFor={`fa-section-${index}-body`}>Body (markdown)</Label>
                <Textarea id={`fa-section-${index}-body`} {...register(`sections.${index}.bodyContent`, { required: true })} rows={6} />
              </div>
              <div>
                <Label>Image</Label>
                <div className="mt-1 flex items-center gap-3">
                  <Input placeholder="Image URL" {...register(`sections.${index}.imageUrl`)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => setSectionImagePickerIndex(index)}>
                    Browse Library
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-h4 font-heading text-charcoal">Recipes to try</h2>
        <FoodAcademyRecipePicker recipeIds={recipeIds} onChange={(ids) => setValue("recipeIds", ids)} />
      </section>

      <section className="space-y-3">
        <h2 className="text-h4 font-heading text-charcoal">Products used</h2>
        <FoodAcademyProductPicker productIds={productIds} onChange={(ids) => setValue("productIds", ids)} />
      </section>

      <AssetPickerDialog
        open={heroPickerOpen}
        onOpenChange={setHeroPickerOpen}
        onSelect={(asset) => {
          setValue("heroImageUrl", asset.url);
          setHeroPickerOpen(false);
        }}
      />
      <AssetPickerDialog
        open={sectionImagePickerIndex !== null}
        onOpenChange={(open) => {
          if (!open) setSectionImagePickerIndex(null);
        }}
        onSelect={(asset) => {
          if (sectionImagePickerIndex === null) return;
          setValue(`sections.${sectionImagePickerIndex}.imageUrl`, asset.url);
          setSectionImagePickerIndex(null);
        }}
      />
    </form>
  );
}
