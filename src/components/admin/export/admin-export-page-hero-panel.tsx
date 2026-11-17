"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  fetchExportPageHeroSetting,
  updateExportPageHeroSetting,
  type ExportPageHeroSettingInput,
} from "@/lib/api/admin-export-content-client";
import { toastManager } from "@/lib/toast";

const EMPTY_VALUES: ExportPageHeroSettingInput = {
  backgroundImageUrl: "",
  backgroundImageAlt: "",
  eyebrow: "",
  headline: "",
  description: "",
  primaryCtaLabel: "",
  primaryCtaHref: "",
  secondaryCtaLabel: "",
  secondaryCtaHref: "",
};

/** /export page revamp. Self-contained (own fetch+save), same pattern as CompanySettingsPanel. Every field falls back to the page's original approved copy until saved — see export-content.service.ts::getPageHeroForStorefront. */
export function AdminExportPageHeroPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-export-page-hero"], queryFn: fetchExportPageHeroSetting });
  const [values, setValues] = useState<ExportPageHeroSettingInput>(EMPTY_VALUES);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  if (data && !seeded) {
    setSeeded(true);
    setValues({
      backgroundImageUrl: data.backgroundImageUrl ?? "",
      backgroundImageAlt: data.backgroundImageAlt ?? "",
      eyebrow: data.eyebrow ?? "",
      headline: data.headline ?? "",
      description: data.description ?? "",
      primaryCtaLabel: data.primaryCtaLabel ?? "",
      primaryCtaHref: data.primaryCtaHref ?? "",
      secondaryCtaLabel: data.secondaryCtaLabel ?? "",
      secondaryCtaHref: data.secondaryCtaHref ?? "",
    });
  }

  function setField<K extends keyof ExportPageHeroSettingInput>(key: K, value: ExportPageHeroSettingInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    try {
      await updateExportPageHeroSetting(values);
      toastManager.add({ title: "Hero saved" });
      queryClient.invalidateQueries({ queryKey: ["admin-export-page-hero"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the hero.");
    }
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <div>
        <h2 className="text-h3 font-heading text-charcoal">Hero</h2>
        <p className="mt-1 text-small text-charcoal/70">
          The top of the /export page — image, headline, and two call-to-action buttons. Leave fields blank to keep
          the original approved copy.
        </p>
      </div>

      {error && <p className="text-small text-destructive">{error}</p>}

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
          {values.backgroundImageUrl ? "Change image" : "Choose image"}
        </Button>
        {values.backgroundImageUrl && <span className="truncate text-small text-charcoal/60">{values.backgroundImageAlt}</span>}
      </div>

      <div>
        <Label htmlFor="hero-eyebrow">Eyebrow</Label>
        <Input id="hero-eyebrow" placeholder="Export Solutions" value={values.eyebrow ?? ""} onChange={(event) => setField("eyebrow", event.target.value)} />
      </div>
      <div>
        <Label htmlFor="hero-headline">Headline</Label>
        <Input id="hero-headline" placeholder="Partner with Oristor for Global Distribution" value={values.headline ?? ""} onChange={(event) => setField("headline", event.target.value)} />
      </div>
      <div>
        <Label htmlFor="hero-description">Description</Label>
        <Input id="hero-description" value={values.description ?? ""} onChange={(event) => setField("description", event.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="hero-primary-label">Primary CTA label</Label>
          <Input id="hero-primary-label" placeholder="Explore Export Catalogue" value={values.primaryCtaLabel ?? ""} onChange={(event) => setField("primaryCtaLabel", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="hero-primary-href">Primary CTA destination</Label>
          <Input id="hero-primary-href" placeholder="/export#catalogue" value={values.primaryCtaHref ?? ""} onChange={(event) => setField("primaryCtaHref", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="hero-secondary-label">Secondary CTA label (optional)</Label>
          <Input id="hero-secondary-label" placeholder="Download Brochure" value={values.secondaryCtaLabel ?? ""} onChange={(event) => setField("secondaryCtaLabel", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="hero-secondary-href">Secondary CTA destination</Label>
          <Input id="hero-secondary-href" value={values.secondaryCtaHref ?? ""} onChange={(event) => setField("secondaryCtaHref", event.target.value)} />
        </div>
      </div>

      <Button type="button" className="w-fit" onClick={handleSave}>
        Save
      </Button>

      <AssetPickerDialog
        open={picker}
        onOpenChange={setPicker}
        onSelect={(asset) => {
          setField("backgroundImageUrl", asset.url);
          setField("backgroundImageAlt", asset.altText ?? "");
          setPicker(false);
        }}
      />
    </div>
  );
}
