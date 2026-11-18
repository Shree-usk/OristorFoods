"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, type UseFormRegister } from "react-hook-form";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchFoodAcademyPageSetting,
  saveFoodAcademyPageSetting,
  type FoodAcademyPageSettingInput,
} from "@/lib/api/admin-food-academy-client";

type FormValues = FoodAcademyPageSettingInput;

const EMPTY_VALUES: FormValues = {
  enabled: true,
  heroEyebrow: "",
  heroHeading: "",
  heroDescription: "",
  heroPrimaryCtaLabel: "",
  heroPrimaryCtaHref: "",
  heroSecondaryCtaLabel: "",
  heroSecondaryCtaHref: "",
  heroImageUrl: "",
  heroImageAlt: "",
  heroBadgeText: "",
  exploreHeading: "",
  exploreDescription: "",
  featuredHeading: "",
  featuredDescription: "",
  instagramEnabled: true,
  instagramHeading: "",
  instagramDescription: "",
  instagramCtaLabel: "",
  instagramCtaHref: "",
  seoTitle: "",
  seoMetaDescription: "",
  seoCanonicalPath: "",
  seoOgImageUrl: "",
};

/**
 * Admin editor for the /food-academy page's hero, section copy, Instagram
 * section config, and SEO fields — a single singleton row
 * (FoodAcademyPageSetting), same editing shape as AdminStoryPagesView's
 * Contact tab, not a repeating-block list like its About tab.
 */
export function AdminFoodAcademyPageSettingsView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-food-academy-page-setting"], queryFn: fetchFoodAcademyPageSetting });
  const { register, handleSubmit, reset, setValue, watch } = useForm<FormValues>({ defaultValues: EMPTY_VALUES });
  const [pickerTarget, setPickerTarget] = useState<"heroImageUrl" | "seoOgImageUrl" | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (data === undefined) return;
    reset({
      enabled: data?.enabled ?? true,
      heroEyebrow: data?.heroEyebrow ?? "",
      heroHeading: data?.heroHeading ?? "",
      heroDescription: data?.heroDescription ?? "",
      heroPrimaryCtaLabel: data?.heroPrimaryCtaLabel ?? "",
      heroPrimaryCtaHref: data?.heroPrimaryCtaHref ?? "",
      heroSecondaryCtaLabel: data?.heroSecondaryCtaLabel ?? "",
      heroSecondaryCtaHref: data?.heroSecondaryCtaHref ?? "",
      heroImageUrl: data?.heroImageUrl ?? "",
      heroImageAlt: data?.heroImageAlt ?? "",
      heroBadgeText: data?.heroBadgeText ?? "",
      exploreHeading: data?.exploreHeading ?? "",
      exploreDescription: data?.exploreDescription ?? "",
      featuredHeading: data?.featuredHeading ?? "",
      featuredDescription: data?.featuredDescription ?? "",
      instagramEnabled: data?.instagramEnabled ?? true,
      instagramHeading: data?.instagramHeading ?? "",
      instagramDescription: data?.instagramDescription ?? "",
      instagramCtaLabel: data?.instagramCtaLabel ?? "",
      instagramCtaHref: data?.instagramCtaHref ?? "",
      seoTitle: data?.seoTitle ?? "",
      seoMetaDescription: data?.seoMetaDescription ?? "",
      seoCanonicalPath: data?.seoCanonicalPath ?? "",
      seoOgImageUrl: data?.seoOgImageUrl ?? "",
    });
  }, [data, reset]);

  const mutation = useMutation({
    mutationFn: (form: FormValues) => saveFoodAcademyPageSetting(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-food-academy-page-setting"] });
      setSaved(true);
    },
  });

  function onSubmit(form: FormValues) {
    setSaved(false);
    mutation.mutate(form);
  }

  if (isLoading) return <p className="text-small text-muted-foreground">Loading…</p>;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-10">
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h4 font-heading text-charcoal">Page</h2>
          <CheckboxOption label="Page enabled" checked={watch("enabled")} onCheckedChange={(checked) => setValue("enabled", checked)} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">Hero</h2>
        <div>
          <Label htmlFor="fa-hero-eyebrow">Eyebrow</Label>
          <Input id="fa-hero-eyebrow" {...register("heroEyebrow")} />
        </div>
        <div>
          <Label htmlFor="fa-hero-heading">Heading</Label>
          <Input id="fa-hero-heading" {...register("heroHeading")} />
        </div>
        <div>
          <Label htmlFor="fa-hero-description">Description</Label>
          <Textarea id="fa-hero-description" {...register("heroDescription")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fa-hero-primary-label">Primary CTA label</Label>
            <Input id="fa-hero-primary-label" {...register("heroPrimaryCtaLabel")} />
          </div>
          <div>
            <Label htmlFor="fa-hero-primary-href">Primary CTA destination</Label>
            <Input id="fa-hero-primary-href" {...register("heroPrimaryCtaHref")} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fa-hero-secondary-label">Secondary CTA label</Label>
            <Input id="fa-hero-secondary-label" {...register("heroSecondaryCtaLabel")} />
          </div>
          <div>
            <Label htmlFor="fa-hero-secondary-href">Secondary CTA destination</Label>
            <Input id="fa-hero-secondary-href" {...register("heroSecondaryCtaHref")} />
          </div>
        </div>
        <ImageField
          label="Hero image"
          urlRegister={register("heroImageUrl")}
          altRegister={register("heroImageAlt")}
          onBrowse={() => setPickerTarget("heroImageUrl")}
        />
        <div>
          <Label htmlFor="fa-hero-badge">Badge text</Label>
          <Input id="fa-hero-badge" {...register("heroBadgeText")} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">Explore the world of flavour</h2>
        <div>
          <Label htmlFor="fa-explore-heading">Heading</Label>
          <Input id="fa-explore-heading" {...register("exploreHeading")} />
        </div>
        <div>
          <Label htmlFor="fa-explore-description">Description</Label>
          <Textarea id="fa-explore-description" {...register("exploreDescription")} />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">Featured learning content</h2>
        <div>
          <Label htmlFor="fa-featured-heading">Heading</Label>
          <Input id="fa-featured-heading" {...register("featuredHeading")} />
        </div>
        <div>
          <Label htmlFor="fa-featured-description">Description</Label>
          <Textarea id="fa-featured-description" {...register("featuredDescription")} />
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-h4 font-heading text-charcoal">Instagram</h2>
          <CheckboxOption label="Section enabled" checked={watch("instagramEnabled")} onCheckedChange={(checked) => setValue("instagramEnabled", checked)} />
        </div>
        <div>
          <Label htmlFor="fa-instagram-heading">Heading</Label>
          <Input id="fa-instagram-heading" {...register("instagramHeading")} />
        </div>
        <div>
          <Label htmlFor="fa-instagram-description">Description</Label>
          <Textarea id="fa-instagram-description" {...register("instagramDescription")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="fa-instagram-cta-label">CTA label</Label>
            <Input id="fa-instagram-cta-label" {...register("instagramCtaLabel")} />
          </div>
          <div>
            <Label htmlFor="fa-instagram-cta-href">CTA destination</Label>
            <Input id="fa-instagram-cta-href" {...register("instagramCtaHref")} />
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-h4 font-heading text-charcoal">SEO</h2>
        <div>
          <Label htmlFor="fa-seo-title">Page title</Label>
          <Input id="fa-seo-title" {...register("seoTitle")} />
        </div>
        <div>
          <Label htmlFor="fa-seo-description">Meta description</Label>
          <Textarea id="fa-seo-description" {...register("seoMetaDescription")} />
        </div>
        <div>
          <Label htmlFor="fa-seo-canonical">Canonical path</Label>
          <Input id="fa-seo-canonical" {...register("seoCanonicalPath")} />
        </div>
        <ImageField
          label="Social sharing image"
          urlRegister={register("seoOgImageUrl")}
          altRegister={undefined}
          onBrowse={() => setPickerTarget("seoOgImageUrl")}
        />
      </section>

      {mutation.isError && <p className="text-small text-chilli">{mutation.error instanceof Error ? mutation.error.message : "Failed to save."}</p>}
      {saved && !mutation.isPending && <p className="text-small text-green-700">Saved.</p>}

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Saving…" : "Save Page Settings"}
      </Button>

      <AssetPickerDialog
        open={pickerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setPickerTarget(null);
        }}
        onSelect={(asset) => {
          if (!pickerTarget) return;
          setValue(pickerTarget, asset.url);
          if (pickerTarget === "heroImageUrl" && asset.altText) setValue("heroImageAlt", asset.altText);
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
  urlRegister: ReturnType<UseFormRegister<FormValues>>;
  altRegister?: ReturnType<UseFormRegister<FormValues>>;
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
      {altRegister && <Input placeholder="Alt text" {...altRegister} />}
    </div>
  );
}
