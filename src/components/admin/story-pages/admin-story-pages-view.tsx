"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { fetchContactPageCopy, fetchStoryPageBlocks, saveContactPageCopy, saveStoryPageBlocks, type StoryPageBlock, type StoryPageBlockInput } from "@/lib/api/admin-story-pages-client";

/** STORY-074. Admin editor for the About and Contact pages' text/image content. */
export function AdminStoryPagesView() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <h1 className="text-h2 font-heading text-charcoal">Page Content</h1>
        <p className="mt-1 text-small text-muted-foreground">Edit the text and images on the About Us and Contact Us pages.</p>
      </div>

      <Tabs defaultValue="about">
        <TabsList>
          <TabsTrigger value="about">About Us</TabsTrigger>
          <TabsTrigger value="contact">Contact Us</TabsTrigger>
        </TabsList>
        <TabsContent value="about" className="mt-6">
          <AboutPageEditor />
        </TabsContent>
        <TabsContent value="contact" className="mt-6">
          <ContactPageEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// --- Contact tab: 4 plain strings on CompanySetting, no images. ---

interface ContactForm {
  contactHeroEyebrow: string;
  contactHeroHeadline: string;
  contactHeroSubcopy: string;
  contactLocationHeading: string;
}

function ContactPageEditor() {
  // `data` resolves to `null` when no CompanySetting row exists yet (it's
  // never pre-seeded) — a valid, non-loading state, not "still fetching".
  // Mounted once (no content-based key): the form's own local state is
  // already the saved values right after a successful save, so there's
  // no need to remount from the refetch that invalidateQueries triggers
  // — doing so would wipe the "Saved." confirmation before it's seen.
  const { data, isLoading, isSuccess } = useQuery({ queryKey: ["admin-contact-page-copy"], queryFn: fetchContactPageCopy });

  if (isLoading || !isSuccess) return <p className="text-small text-muted-foreground">Loading…</p>;

  return <ContactPageForm initial={data} />;
}

function ContactPageForm({ initial }: { initial: Awaited<ReturnType<typeof fetchContactPageCopy>> }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ContactForm>({
    contactHeroEyebrow: initial?.contactHeroEyebrow ?? "",
    contactHeroHeadline: initial?.contactHeroHeadline ?? "",
    contactHeroSubcopy: initial?.contactHeroSubcopy ?? "",
    contactLocationHeading: initial?.contactLocationHeading ?? "",
  });
  const [saved, setSaved] = useState(false);

  const mutation = useMutation({
    mutationFn: (input: ContactForm) => saveContactPageCopy(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-contact-page-copy"] });
      setSaved(true);
    },
  });

  function set<K extends keyof ContactForm>(key: K, value: ContactForm[K]) {
    setSaved(false);
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <Label htmlFor="contact-hero-eyebrow">Hero eyebrow</Label>
        <Input id="contact-hero-eyebrow" value={form.contactHeroEyebrow} onChange={(event) => set("contactHeroEyebrow", event.target.value)} />
      </div>
      <div>
        <Label htmlFor="contact-hero-headline">Hero headline</Label>
        <Input id="contact-hero-headline" value={form.contactHeroHeadline} onChange={(event) => set("contactHeroHeadline", event.target.value)} />
      </div>
      <div>
        <Label htmlFor="contact-hero-subcopy">Hero subcopy</Label>
        <Textarea id="contact-hero-subcopy" value={form.contactHeroSubcopy} onChange={(event) => set("contactHeroSubcopy", event.target.value)} />
      </div>
      <div>
        <Label htmlFor="contact-location-heading">Location heading</Label>
        <Input id="contact-location-heading" value={form.contactLocationHeading} onChange={(event) => set("contactLocationHeading", event.target.value)} />
      </div>

      {mutation.isError && <p className="text-small text-chilli">{mutation.error instanceof Error ? mutation.error.message : "Failed to save."}</p>}
      {saved && !mutation.isPending && <p className="text-small text-green-700">Saved.</p>}

      <Button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save Contact Page"}
      </Button>
    </div>
  );
}

// --- About tab: 7 StoryPageBlock groups, one bulk save. ---

interface AboutForm {
  hero: StoryPageBlockInput;
  chapters: StoryPageBlockInput[];
  ingredients: StoryPageBlockInput[];
  categories: StoryPageBlockInput[];
  values: StoryPageBlockInput[];
  globalJourney: StoryPageBlockInput;
  cta: StoryPageBlockInput;
}

function toInput(block: StoryPageBlock): StoryPageBlockInput {
  const { blockKey, blockType, sortOrder, eyebrow, title, body, imageUrl, imageAlt, ctaLabel, ctaHref, secondaryCtaLabel, secondaryCtaHref, align, letter } = block;
  return { blockKey, blockType, sortOrder, eyebrow, title, body, imageUrl, imageAlt, ctaLabel, ctaHref, secondaryCtaLabel, secondaryCtaHref, align, letter };
}

function blocksToForm(blocks: StoryPageBlock[]): AboutForm {
  const byType = (type: StoryPageBlock["blockType"]) => blocks.filter((block) => block.blockType === type).sort((a, b) => a.sortOrder - b.sortOrder).map(toInput);
  return {
    hero: byType("Hero")[0] ?? { blockKey: "hero", blockType: "Hero", sortOrder: 0, eyebrow: "", title: "", body: "", imageUrl: "", imageAlt: "", ctaLabel: null, ctaHref: null, secondaryCtaLabel: null, secondaryCtaHref: null, align: null, letter: null },
    chapters: byType("Chapter"),
    ingredients: byType("IngredientItem"),
    categories: byType("ProductCategoryItem"),
    values: byType("ValueItem"),
    globalJourney: byType("GlobalJourney")[0] ?? { blockKey: "global-journey", blockType: "GlobalJourney", sortOrder: 0, eyebrow: null, title: "", body: "", imageUrl: null, imageAlt: null, ctaLabel: "", ctaHref: "", secondaryCtaLabel: null, secondaryCtaHref: null, align: null, letter: null },
    cta: byType("Cta")[0] ?? { blockKey: "cta", blockType: "Cta", sortOrder: 0, eyebrow: null, title: "", body: "", imageUrl: null, imageAlt: null, ctaLabel: "", ctaHref: "", secondaryCtaLabel: "", secondaryCtaHref: "", align: null, letter: null },
  };
}

type PickerTarget = { group: "hero" } | { group: "chapters" | "ingredients" | "categories"; index: number };

function AboutPageEditor() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-story-page-blocks", "AboutUs"], queryFn: () => fetchStoryPageBlocks("AboutUs") });
  const { control, register, handleSubmit, reset, setValue } = useForm<AboutForm>();
  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data) reset(blocksToForm(data));
  }, [data, reset]);

  const chapters = useFieldArray({ control, name: "chapters" });
  const ingredients = useFieldArray({ control, name: "ingredients" });
  const categories = useFieldArray({ control, name: "categories" });
  const values = useFieldArray({ control, name: "values" });

  const mutation = useMutation({
    mutationFn: (form: AboutForm) => {
      const blocks: StoryPageBlockInput[] = [
        form.hero,
        ...form.chapters,
        ...form.ingredients.map((item, index) => ({ ...item, sortOrder: index })),
        ...form.categories.map((item, index) => ({ ...item, sortOrder: index })),
        ...form.values.map((item, index) => ({ ...item, sortOrder: index })),
        form.globalJourney,
        form.cta,
      ];
      return saveStoryPageBlocks("AboutUs", blocks);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-story-page-blocks", "AboutUs"] });
      setSaved(true);
    },
  });

  function onSubmit(form: AboutForm) {
    setSaved(false);
    mutation.mutate(form);
  }

  if (isLoading || !data) return <p className="text-small text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-10">
      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">Hero</h2>
        <div>
          <Label htmlFor="hero-eyebrow">Eyebrow</Label>
          <Input id="hero-eyebrow" {...register("hero.eyebrow")} />
        </div>
        <div>
          <Label htmlFor="hero-headline">Headline</Label>
          <Input id="hero-headline" {...register("hero.title")} />
        </div>
        <div>
          <Label htmlFor="hero-subcopy">Subcopy</Label>
          <Textarea id="hero-subcopy" {...register("hero.body")} />
        </div>
        <ImageField label="Image" urlRegister={register("hero.imageUrl")} altRegister={register("hero.imageAlt")} onBrowse={() => setPickerTarget({ group: "hero" })} />
      </section>

      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">Chapters</h2>
        <p className="text-small text-muted-foreground">The 4 story chapters — text and image per chapter. The number and order of chapters is fixed.</p>
        {chapters.fields.map((field, index) => (
          <div key={field.id} className="space-y-3 rounded-md border border-border p-4">
            <div>
              <Label htmlFor={`chapter-${index}-eyebrow`}>Eyebrow</Label>
              <Input id={`chapter-${index}-eyebrow`} {...register(`chapters.${index}.eyebrow`)} />
            </div>
            <div>
              <Label htmlFor={`chapter-${index}-title`}>Title</Label>
              <Input id={`chapter-${index}-title`} {...register(`chapters.${index}.title`)} />
            </div>
            <div>
              <Label htmlFor={`chapter-${index}-body`}>Body</Label>
              <Textarea id={`chapter-${index}-body`} {...register(`chapters.${index}.body`)} />
            </div>
            <ImageField label="Image" urlRegister={register(`chapters.${index}.imageUrl`)} altRegister={register(`chapters.${index}.imageAlt`)} onBrowse={() => setPickerTarget({ group: "chapters", index })} />
            <div>
              <Label htmlFor={`chapter-${index}-align`}>Image alignment</Label>
              <Controller
                control={control}
                name={`chapters.${index}.align`}
                render={({ field: alignField }) => (
                  <Select value={alignField.value ?? "Left"} onValueChange={alignField.onChange}>
                    <SelectTrigger id={`chapter-${index}-align`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Left">Left</SelectItem>
                      <SelectItem value="Right">Right</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        ))}
      </section>

      <RepeatingSection
        title="Ingredients"
        description="Shown in the “Flavours We Grew Up With” chapter."
        fields={ingredients.fields}
        onAdd={() => ingredients.append({ blockKey: `ingredient-${crypto.randomUUID()}`, blockType: "IngredientItem", sortOrder: ingredients.fields.length, eyebrow: null, title: "", body: "", imageUrl: "", imageAlt: "", ctaLabel: null, ctaHref: null, secondaryCtaLabel: null, secondaryCtaHref: null, align: null, letter: null })}
        onRemove={ingredients.remove}
        renderFields={(index) => (
          <>
            <div>
              <Label htmlFor={`ingredient-${index}-name`}>Name</Label>
              <Input id={`ingredient-${index}-name`} {...register(`ingredients.${index}.title`)} />
            </div>
            <div>
              <Label htmlFor={`ingredient-${index}-tagline`}>Tagline</Label>
              <Input id={`ingredient-${index}-tagline`} {...register(`ingredients.${index}.body`)} />
            </div>
            <ImageField label="Image" urlRegister={register(`ingredients.${index}.imageUrl`)} altRegister={register(`ingredients.${index}.imageAlt`)} onBrowse={() => setPickerTarget({ group: "ingredients", index })} />
          </>
        )}
      />

      <RepeatingSection
        title="Product Categories"
        description="The scrolling product sequence."
        fields={categories.fields}
        onAdd={() => categories.append({ blockKey: `category-${crypto.randomUUID()}`, blockType: "ProductCategoryItem", sortOrder: categories.fields.length, eyebrow: null, title: "", body: "", imageUrl: "", imageAlt: "", ctaLabel: null, ctaHref: null, secondaryCtaLabel: null, secondaryCtaHref: null, align: null, letter: null })}
        onRemove={categories.remove}
        renderFields={(index) => (
          <>
            <div>
              <Label htmlFor={`category-${index}-name`}>Name</Label>
              <Input id={`category-${index}-name`} {...register(`categories.${index}.title`)} />
            </div>
            <div>
              <Label htmlFor={`category-${index}-tagline`}>Tagline</Label>
              <Input id={`category-${index}-tagline`} {...register(`categories.${index}.body`)} />
            </div>
            <ImageField label="Image" urlRegister={register(`categories.${index}.imageUrl`)} altRegister={register(`categories.${index}.imageAlt`)} onBrowse={() => setPickerTarget({ group: "categories", index })} />
          </>
        )}
      />

      <RepeatingSection
        title="Values"
        description="The O-R-I-S-T-O-R acrostic. No image per value."
        fields={values.fields}
        onAdd={() => values.append({ blockKey: `value-${crypto.randomUUID()}`, blockType: "ValueItem", sortOrder: values.fields.length, eyebrow: null, title: "", body: "", imageUrl: null, imageAlt: null, ctaLabel: null, ctaHref: null, secondaryCtaLabel: null, secondaryCtaHref: null, align: null, letter: "" })}
        onRemove={values.remove}
        renderFields={(index) => (
          <>
            <div className="w-20">
              <Label htmlFor={`value-${index}-letter`}>Letter</Label>
              <Input id={`value-${index}-letter`} maxLength={2} {...register(`values.${index}.letter`)} />
            </div>
            <div>
              <Label htmlFor={`value-${index}-word`}>Word</Label>
              <Input id={`value-${index}-word`} {...register(`values.${index}.title`)} />
            </div>
            <div>
              <Label htmlFor={`value-${index}-description`}>Description</Label>
              <Input id={`value-${index}-description`} {...register(`values.${index}.body`)} />
            </div>
          </>
        )}
      />

      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">Global Journey</h2>
        <div>
          <Label htmlFor="global-journey-title">Title</Label>
          <Input id="global-journey-title" {...register("globalJourney.title")} />
        </div>
        <div>
          <Label htmlFor="global-journey-body">Body</Label>
          <Textarea id="global-journey-body" {...register("globalJourney.body")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="global-journey-cta-label">CTA label</Label>
            <Input id="global-journey-cta-label" {...register("globalJourney.ctaLabel")} />
          </div>
          <div>
            <Label htmlFor="global-journey-cta-href">CTA destination</Label>
            <Input id="global-journey-cta-href" {...register("globalJourney.ctaHref")} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">Closing CTA</h2>
        <div>
          <Label htmlFor="cta-headline">Headline</Label>
          <Input id="cta-headline" {...register("cta.title")} />
        </div>
        <div>
          <Label htmlFor="cta-subcopy">Subcopy</Label>
          <Textarea id="cta-subcopy" {...register("cta.body")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cta-primary-label">Primary label</Label>
            <Input id="cta-primary-label" {...register("cta.ctaLabel")} />
          </div>
          <div>
            <Label htmlFor="cta-primary-href">Primary destination</Label>
            <Input id="cta-primary-href" {...register("cta.ctaHref")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="cta-secondary-label">Secondary label</Label>
            <Input id="cta-secondary-label" {...register("cta.secondaryCtaLabel")} />
          </div>
          <div>
            <Label htmlFor="cta-secondary-href">Secondary destination</Label>
            <Input id="cta-secondary-href" {...register("cta.secondaryCtaHref")} />
          </div>
        </div>
      </section>

      {mutation.isError && <p className="text-small text-chilli">{mutation.error instanceof Error ? mutation.error.message : "Failed to save."}</p>}
      {saved && !mutation.isPending && <p className="text-small text-green-700">Saved.</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save About Page"}
      </Button>

      <AssetPickerDialog
        open={pickerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPickerTarget(null);
        }}
        onSelect={(asset) => {
          if (!pickerTarget) return;
          if (pickerTarget.group === "hero") {
            setValue("hero.imageUrl", asset.url);
            if (asset.altText) setValue("hero.imageAlt", asset.altText);
          } else {
            setValue(`${pickerTarget.group}.${pickerTarget.index}.imageUrl`, asset.url);
            if (asset.altText) setValue(`${pickerTarget.group}.${pickerTarget.index}.imageAlt`, asset.altText);
          }
          setPickerTarget(null);
        }}
      />
    </form>
  );
}

function ImageField({
  label,
  urlRegister,
  altRegister,
  onBrowse,
}: {
  label: string;
  urlRegister: ReturnType<ReturnType<typeof useForm<AboutForm>>["register"]>;
  altRegister: ReturnType<ReturnType<typeof useForm<AboutForm>>["register"]>;
  onBrowse: () => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input placeholder="Image URL" {...urlRegister} />
        <Button type="button" variant="outline" onClick={onBrowse}>
          Browse Library
        </Button>
      </div>
      <Input placeholder="Alt text" {...altRegister} />
    </div>
  );
}

function RepeatingSection({
  title,
  description,
  fields,
  onAdd,
  onRemove,
  renderFields,
}: {
  title: string;
  description: string;
  fields: { id: string }[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  renderFields: (index: number) => React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-h4 font-heading text-charcoal">{title}</h2>
          <p className="text-small text-muted-foreground">{description}</p>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={onAdd}>
          Add
        </Button>
      </div>
      {fields.map((field, index) => (
        <div key={field.id} className="space-y-3 rounded-md border border-border p-4">
          {renderFields(index)}
          <Button type="button" size="sm" variant="ghost" onClick={() => onRemove(index)}>
            Remove
          </Button>
        </div>
      ))}
    </section>
  );
}
