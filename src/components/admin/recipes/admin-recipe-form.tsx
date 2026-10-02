"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { RecipeIngredientProductPicker } from "@/components/admin/recipes/recipe-ingredient-product-picker";
import { SeoFieldsPanel } from "@/components/admin/seo/seo-fields-panel";
import {
  approveRecipe,
  archiveRecipe,
  createAdminRecipe,
  deleteAdminRecipe,
  fetchAdminRecipe,
  fetchRecipeFormReferenceData,
  publishRecipe,
  rejectRecipe,
  restoreRecipe,
  submitRecipeForReview,
  updateAdminRecipe,
} from "@/lib/api/admin-recipe-client";
import { recipeAdminSchema, type RecipeAdminFormInput } from "@/validation/recipe-admin.schema";

const DIFFICULTIES = ["Easy", "Medium", "Hard"] as const;
const VIDEO_PROVIDERS = ["Youtube", "Vimeo", "SelfHosted"] as const;

/**
 * register(name, { valueAsNumber: true }) reads the input's native
 * `.valueAsNumber`, which is NaN (not undefined) for an empty `<input
 * type="number">` — Zod's `.optional()` only accepts undefined, so a
 * blank optional number field (e.g. an ingredient with no quantity,
 * "salt to taste") silently failed validation with no visible error
 * message on the wrong tab. setValueAs coerces blank to undefined instead.
 */
const optionalNumber = { setValueAs: (value: string) => (value === "" ? undefined : Number(value)) };

const NEXT_ACTIONS: Record<string, { label: string; action: "submit" | "approve" | "reject" | "publish" | "archive" | "restore" }[]> = {
  Draft: [{ label: "Submit for Review", action: "submit" }],
  Review: [
    { label: "Approve", action: "approve" },
    { label: "Reject", action: "reject" },
  ],
  Approved: [
    { label: "Publish", action: "publish" },
    { label: "Reject", action: "reject" },
  ],
  Published: [{ label: "Archive", action: "archive" }],
  Archived: [{ label: "Restore to Draft", action: "restore" }],
};

const EMPTY_VALUES: RecipeAdminFormInput = {
  slug: "",
  title: "",
  shortDescription: "",
  heroImage: "",
  heroImageAlt: "",
  galleryImageUrls: [],
  categoryId: "",
  cuisine: "",
  difficulty: "Easy",
  prepTimeMinutes: 0,
  cookTimeMinutes: 0,
  servings: 1,
  isFeatured: false,
  chefNotes: "",
  nutritionCalories: undefined,
  nutritionProtein: undefined,
  nutritionCarbs: undefined,
  nutritionFat: undefined,
  nutritionFiber: undefined,
  nutritionSodium: undefined,
  videoUrl: "",
  videoProvider: undefined,
  videoDurationSeconds: undefined,
  captionsUrl: "",
  dietaryTagIds: [],
  ingredients: [],
  steps: [],
};

/** STORY-043. New vs. edit via an optional recipeId — both share this one form, mirroring admin-product-form.tsx's pattern exactly. */
export function AdminRecipeForm({ recipeId }: { recipeId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("details");
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [stepPickerIndex, setStepPickerIndex] = useState<number | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: referenceData } = useQuery({
    queryKey: ["admin-recipes-reference-data"],
    queryFn: fetchRecipeFormReferenceData,
  });

  const { data: existingRecipe } = useQuery({
    queryKey: ["admin-recipe", recipeId],
    queryFn: () => fetchAdminRecipe(recipeId!),
    enabled: Boolean(recipeId),
    // Same reasoning as admin-product-form.tsx: a background refetch (e.g.
    // AssetPickerDialog stealing/returning window focus) must never race
    // an in-progress, unsaved edit.
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
  } = useForm<RecipeAdminFormInput>({ resolver: zodResolver(recipeAdminSchema), defaultValues: EMPTY_VALUES });

  const initializedRecipeId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!existingRecipe) return;
    if (initializedRecipeId.current === existingRecipe.id) return;
    initializedRecipeId.current = existingRecipe.id;
    reset({
      slug: existingRecipe.slug,
      title: existingRecipe.title,
      shortDescription: existingRecipe.shortDescription,
      heroImage: existingRecipe.heroImage,
      heroImageAlt: existingRecipe.heroImageAlt,
      galleryImageUrls: existingRecipe.galleryImageUrls,
      categoryId: existingRecipe.categoryId,
      cuisine: existingRecipe.cuisine ?? "",
      difficulty: existingRecipe.difficulty,
      prepTimeMinutes: existingRecipe.prepTimeMinutes,
      cookTimeMinutes: existingRecipe.cookTimeMinutes,
      servings: existingRecipe.servings,
      isFeatured: existingRecipe.isFeatured,
      chefNotes: existingRecipe.chefNotes ?? "",
      nutritionCalories: existingRecipe.nutritionCalories ?? undefined,
      nutritionProtein: existingRecipe.nutritionProtein ?? undefined,
      nutritionCarbs: existingRecipe.nutritionCarbs ?? undefined,
      nutritionFat: existingRecipe.nutritionFat ?? undefined,
      nutritionFiber: existingRecipe.nutritionFiber ?? undefined,
      nutritionSodium: existingRecipe.nutritionSodium ?? undefined,
      videoUrl: existingRecipe.videoUrl ?? "",
      videoProvider: existingRecipe.videoProvider ?? undefined,
      videoDurationSeconds: existingRecipe.videoDurationSeconds ?? undefined,
      captionsUrl: existingRecipe.captionsUrl ?? "",
      dietaryTagIds: existingRecipe.dietaryTags.map((t: { dietaryTag: { id: string } }) => t.dietaryTag.id),
      ingredients: existingRecipe.ingredients.map((i: { quantity: string | null; unit: string | null; displayText: string; product: { id: string } | null }) => ({
        quantity: i.quantity ? Number(i.quantity) : undefined,
        unit: i.unit ?? "",
        displayText: i.displayText,
        productId: i.product?.id ?? undefined,
      })),
      steps: existingRecipe.steps.map((s: { instruction: string; imageUrl: string | null }) => ({ instruction: s.instruction, imageUrl: s.imageUrl ?? "" })),
    });
  }, [existingRecipe, reset]);

  const ingredients = useFieldArray({ control, name: "ingredients" });
  const steps = useFieldArray({ control, name: "steps" });
  const dietaryTagIds = watch("dietaryTagIds") ?? [];

  function toggleId(current: string[], id: string): string[] {
    return current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
  }

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (recipeId) {
        await updateAdminRecipe(recipeId, values);
        queryClient.invalidateQueries({ queryKey: ["admin-recipe", recipeId] });
      } else {
        const created = await createAdminRecipe(values);
        router.push(`/admin/recipes/${created.id}`);
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  });

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      queryClient.invalidateQueries({ queryKey: ["admin-recipe", recipeId] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function handleDelete() {
    await deleteAdminRecipe(recipeId!);
    router.push("/admin/recipes");
  }

  const status: string | undefined = existingRecipe?.status;

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-h2 font-heading text-charcoal">{recipeId ? "Edit recipe" : "New recipe"}</h1>
          {status && <Badge variant={status === "Published" ? "default" : status === "Archived" ? "outline" : "secondary"}>{status}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {recipeId && status && (
            <>
              {(NEXT_ACTIONS[status] ?? []).map(({ label, action }) => (
                <Button
                  key={action}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (action === "reject") {
                      setRejectComment("");
                      setRejectOpen(true);
                      return;
                    }
                    const fn = { submit: submitRecipeForReview, approve: approveRecipe, publish: publishRecipe, archive: archiveRecipe, restore: restoreRecipe }[action];
                    runAction(() => fn(recipeId));
                  }}
                >
                  {label}
                </Button>
              ))}
              {status === "Draft" && (
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/recipes/${recipeId}/preview`} />}>
                Preview
              </Button>
            </>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {serverError && <p className="mt-2 text-small text-destructive">{serverError}</p>}
      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}
      {existingRecipe?.reviewerComment && (
        <p className="mt-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-small text-destructive">
          <strong>Reviewer feedback:</strong> {existingRecipe.reviewerComment}
        </p>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Reject recipe</h2>
          <p className="mt-1 text-small text-charcoal/70">This sends the recipe back to Draft with your comment visible to the author.</p>
          <Textarea className="mt-3" value={rejectComment} onChange={(event) => setRejectComment(event.target.value)} placeholder="What needs to change?" rows={4} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={!rejectComment.trim()}
              onClick={() => {
                runAction(() => rejectRecipe(recipeId!, rejectComment));
                setRejectOpen(false);
              }}
            >
              Reject
            </Button>
            <Button type="button" variant="outline" onClick={() => setRejectOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as string)} className="mt-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="ingredients">Ingredients</TabsTrigger>
          <TabsTrigger value="steps">Steps</TabsTrigger>
          <TabsTrigger value="nutrition">Nutrition</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="recipe-title">Title</Label>
            <Input id="recipe-title" {...register("title")} />
            {errors.title && <p className="mt-1 text-small text-destructive">{errors.title.message}</p>}
          </div>
          <div>
            <Label htmlFor="recipe-slug">Slug</Label>
            <Input id="recipe-slug" {...register("slug")} />
            {errors.slug && <p className="mt-1 text-small text-destructive">{errors.slug.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="recipe-short-description">Short description</Label>
            <Textarea id="recipe-short-description" {...register("shortDescription")} />
            {errors.shortDescription && <p className="mt-1 text-small text-destructive">{errors.shortDescription.message}</p>}
          </div>
          <div>
            <Label htmlFor="recipe-category">Category</Label>
            <Controller
              control={control}
              name="categoryId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="recipe-category" className="w-full">
                    <SelectValue placeholder="Select a category" />
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
            {errors.categoryId && <p className="mt-1 text-small text-destructive">{errors.categoryId.message}</p>}
          </div>
          <div>
            <Label htmlFor="recipe-cuisine">Cuisine</Label>
            <Input id="recipe-cuisine" {...register("cuisine")} />
          </div>
          <div>
            <Label htmlFor="recipe-difficulty">Difficulty</Label>
            <Controller
              control={control}
              name="difficulty"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="recipe-difficulty" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((difficulty) => (
                      <SelectItem key={difficulty} value={difficulty}>
                        {difficulty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="recipe-servings">Servings</Label>
            <Input id="recipe-servings" type="number" {...register("servings", { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="recipe-prep-time">Prep time (minutes)</Label>
            <Input id="recipe-prep-time" type="number" {...register("prepTimeMinutes", { valueAsNumber: true })} />
          </div>
          <div>
            <Label htmlFor="recipe-cook-time">Cook time (minutes)</Label>
            <Input id="recipe-cook-time" type="number" {...register("cookTimeMinutes", { valueAsNumber: true })} />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="recipe-chef-notes">Chef notes</Label>
            <Textarea id="recipe-chef-notes" rows={4} {...register("chefNotes")} />
          </div>
          <div className="sm:col-span-2">
            <Controller
              control={control}
              name="isFeatured"
              render={({ field }) => <CheckboxOption label="Featured on the homepage" checked={field.value ?? false} onCheckedChange={field.onChange} />}
            />
          </div>
          <div className="sm:col-span-2">
            <Label>Dietary tags</Label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-input p-2 sm:grid-cols-3">
              {(referenceData?.dietaryTags ?? []).map((tag) => (
                <CheckboxOption
                  key={tag.id}
                  label={tag.name}
                  checked={dietaryTagIds.includes(tag.id)}
                  onCheckedChange={() => setValue("dietaryTagIds", toggleId(dietaryTagIds, tag.id))}
                />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="ingredients" className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 font-heading text-charcoal">Ingredients</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => ingredients.append({ displayText: "", quantity: undefined, unit: "", productId: undefined })}>
              Add ingredient
            </Button>
          </div>
          {errors.ingredients && <p className="mt-1 text-small text-destructive">{errors.ingredients.message as string}</p>}
          <div className="mt-2 flex flex-col gap-2">
            {ingredients.fields.map((field, index) => (
              <div key={field.id} className="flex items-center gap-2">
                <Input {...register(`ingredients.${index}.quantity`, optionalNumber)} placeholder="Qty" className="w-20" type="number" step="any" />
                <Input {...register(`ingredients.${index}.unit`)} placeholder="Unit" className="w-24" />
                <Input {...register(`ingredients.${index}.displayText`)} placeholder="Ingredient (e.g. red onion, finely chopped)" className="flex-1" />
                <Controller
                  control={control}
                  name={`ingredients.${index}.productId`}
                  render={({ field }) => <RecipeIngredientProductPicker value={field.value ?? null} onChange={field.onChange} />}
                />
                <Button type="button" size="sm" variant="ghost" onClick={() => ingredients.remove(index)}>
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="steps" className="mt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 font-heading text-charcoal">Method steps</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => steps.append({ instruction: "", imageUrl: "" })}>
              Add step
            </Button>
          </div>
          {errors.steps && <p className="mt-1 text-small text-destructive">{errors.steps.message as string}</p>}
          <div className="mt-2 flex flex-col gap-3">
            {steps.fields.map((field, index) => (
              <div key={field.id} className="rounded-lg border border-input p-3">
                <div className="flex items-center justify-between">
                  <span className="text-small font-medium text-charcoal">Step {index + 1}</span>
                  <Button type="button" size="sm" variant="ghost" onClick={() => steps.remove(index)}>
                    Remove
                  </Button>
                </div>
                <Textarea className="mt-2" {...register(`steps.${index}.instruction`)} placeholder="Instruction" rows={2} />
                <div className="mt-2 flex items-center gap-2">
                  <Input {...register(`steps.${index}.imageUrl`)} placeholder="Step image URL (optional)" className="flex-1" />
                  <Button type="button" size="sm" variant="outline" onClick={() => setStepPickerIndex(index)}>
                    Browse Library
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="nutrition" className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="recipe-calories">Calories</Label>
            <Input id="recipe-calories" type="number" {...register("nutritionCalories", optionalNumber)} />
          </div>
          <div>
            <Label htmlFor="recipe-protein">Protein (g)</Label>
            <Input id="recipe-protein" type="number" {...register("nutritionProtein", optionalNumber)} />
          </div>
          <div>
            <Label htmlFor="recipe-carbs">Carbohydrates (g)</Label>
            <Input id="recipe-carbs" type="number" {...register("nutritionCarbs", optionalNumber)} />
          </div>
          <div>
            <Label htmlFor="recipe-fat">Fat (g)</Label>
            <Input id="recipe-fat" type="number" {...register("nutritionFat", optionalNumber)} />
          </div>
          <div>
            <Label htmlFor="recipe-fiber">Fiber (g)</Label>
            <Input id="recipe-fiber" type="number" {...register("nutritionFiber", optionalNumber)} />
          </div>
          <div>
            <Label htmlFor="recipe-sodium">Sodium (mg)</Label>
            <Input id="recipe-sodium" type="number" {...register("nutritionSodium", optionalNumber)} />
          </div>
        </TabsContent>

        <TabsContent value="media" className="mt-4 space-y-4">
          <div>
            <Label htmlFor="recipe-hero-image">Hero image URL</Label>
            <div className="flex gap-2">
              <Input id="recipe-hero-image" {...register("heroImage")} className="flex-1" />
              <Button type="button" size="sm" variant="outline" onClick={() => setHeroPickerOpen(true)}>
                Browse Library
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="recipe-hero-alt">Hero image alt text</Label>
            <Input id="recipe-hero-alt" {...register("heroImageAlt")} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="recipe-video-url">Video URL</Label>
              <Input id="recipe-video-url" {...register("videoUrl")} placeholder="Uploaded video URL or an embed URL" />
            </div>
            <div>
              <Label htmlFor="recipe-video-provider">Video provider</Label>
              <Controller
                control={control}
                name="videoProvider"
                render={({ field }) => (
                  <Select value={field.value ?? undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="recipe-video-provider" className="w-full">
                      <SelectValue placeholder="No video" />
                    </SelectTrigger>
                    <SelectContent>
                      {VIDEO_PROVIDERS.map((provider) => (
                        <SelectItem key={provider} value={provider}>
                          {provider}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <AssetPickerDialog
            open={heroPickerOpen}
            onOpenChange={setHeroPickerOpen}
            onSelect={(asset) => {
              setValue("heroImage", asset.url);
              setValue("heroImageAlt", asset.altText ?? "");
              setHeroPickerOpen(false);
            }}
          />
          <AssetPickerDialog
            open={stepPickerIndex !== null}
            onOpenChange={(open) => !open && setStepPickerIndex(null)}
            onSelect={(asset) => {
              if (stepPickerIndex === null) return;
              setValue(`steps.${stepPickerIndex}.imageUrl`, asset.url);
              setStepPickerIndex(null);
            }}
          />
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <SeoFieldsPanel entityType="Recipe" entityId={recipeId ?? null} />
        </TabsContent>
      </Tabs>
    </form>
  );
}
