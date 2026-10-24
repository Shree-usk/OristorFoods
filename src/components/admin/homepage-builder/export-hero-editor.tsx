"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import {
  fetchExportHeroSetting,
  updateExportHeroSetting,
  type ExportHeroSettingInput,
  type ExportHeroStatLineItem,
} from "@/lib/api/admin-export-hero-client";

interface ExportHeroEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

const EMPTY_VALUES: ExportHeroSettingInput = {
  backgroundImageUrl: "",
  backgroundImageAlt: "",
  eyebrow: "",
  headline: "",
  description: "",
  primaryCtaLabel: "",
  primaryCtaHref: "",
  secondaryCtaLabel: "",
  secondaryCtaHref: "",
  statLine: [],
  badgeEyebrow: "",
  badgeHeadline: "",
  badgeDescription: "",
  badgeCtaLabel: "",
  badgeCtaHref: "",
};

/**
 * Admin editor for the homepage's Export Solutions hero (ExportHeroSetting
 * — a global singleton, not tied to any one HomepageLayout version). Mirrors
 * CompanySettingsPanel's "seed once from the query result" + repeatable
 * `statLine` array pattern, packaged as a Sheet so homepage-builder-canvas
 * can dispatch to it the same way it dispatches to HeroBannerEditor.
 */
export function ExportHeroEditor({ open, onOpenChange, onChanged }: ExportHeroEditorProps) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<ExportHeroSettingInput>(EMPTY_VALUES);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-export-hero-setting"], queryFn: fetchExportHeroSetting, enabled: open });

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
      statLine: data.statLine ?? [],
      badgeEyebrow: data.badgeEyebrow ?? "",
      badgeHeadline: data.badgeHeadline ?? "",
      badgeDescription: data.badgeDescription ?? "",
      badgeCtaLabel: data.badgeCtaLabel ?? "",
      badgeCtaHref: data.badgeCtaHref ?? "",
    });
  }

  function set<K extends keyof ExportHeroSettingInput>(key: K, value: ExportHeroSettingInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateExportHeroSetting(values);
      queryClient.invalidateQueries({ queryKey: ["admin-export-hero-setting"] });
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the Export Hero settings.");
    } finally {
      setSaving(false);
    }
  }

  const statLine = values.statLine ?? [];

  function setStatLineField(index: number, field: keyof ExportHeroStatLineItem, value: string) {
    set("statLine", statLine.map((entry, i) => (i === index ? { ...entry, [field]: value } : entry)));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Export Solutions hero</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 overflow-y-auto px-4">
          {error && <p className="text-small text-chilli">{error}</p>}

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
              {values.backgroundImageUrl ? "Change background image" : "Choose background image"}
            </Button>
            {values.backgroundImageUrl && <span className="truncate text-small text-muted-foreground">{values.backgroundImageAlt}</span>}
          </div>

          <div>
            <Label htmlFor="export-hero-eyebrow">Eyebrow</Label>
            <Input id="export-hero-eyebrow" value={values.eyebrow ?? ""} onChange={(event) => set("eyebrow", event.target.value)} />
          </div>
          <div>
            <Label htmlFor="export-hero-headline">Headline</Label>
            <Input id="export-hero-headline" value={values.headline ?? ""} onChange={(event) => set("headline", event.target.value)} />
            <p className="mt-1 text-caption text-muted-foreground">Wrap one word or phrase in **double asterisks** to highlight it, e.g. Bring the Taste of **Sri Lanka** to Your Market.</p>
          </div>
          <div>
            <Label htmlFor="export-hero-description">Description</Label>
            <Textarea id="export-hero-description" value={values.description ?? ""} onChange={(event) => set("description", event.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="export-hero-primary-cta-label">Primary CTA label</Label>
              <Input id="export-hero-primary-cta-label" value={values.primaryCtaLabel ?? ""} onChange={(event) => set("primaryCtaLabel", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="export-hero-primary-cta-href">Primary CTA destination</Label>
              <Input id="export-hero-primary-cta-href" value={values.primaryCtaHref ?? ""} onChange={(event) => set("primaryCtaHref", event.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="export-hero-secondary-cta-label">Secondary CTA label</Label>
              <Input id="export-hero-secondary-cta-label" value={values.secondaryCtaLabel ?? ""} onChange={(event) => set("secondaryCtaLabel", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="export-hero-secondary-cta-href">Secondary CTA destination</Label>
              <Input id="export-hero-secondary-cta-href" value={values.secondaryCtaHref ?? ""} onChange={(event) => set("secondaryCtaHref", event.target.value)} />
            </div>
          </div>

          <div>
            <Label>Stat line</Label>
            <div className="mt-1 space-y-2">
              {statLine.map((stat, index) => (
                <div key={index} className="flex gap-2">
                  <Input placeholder="Label" value={stat.label} onChange={(event) => setStatLineField(index, "label", event.target.value)} />
                  <Input placeholder="Description" value={stat.description} onChange={(event) => setStatLineField(index, "description", event.target.value)} />
                  <Button type="button" variant="outline" size="sm" onClick={() => set("statLine", statLine.filter((_, i) => i !== index))}>
                    Remove
                  </Button>
                </div>
              ))}
              <Button type="button" variant="ghost" size="sm" onClick={() => set("statLine", [...statLine, { label: "", description: "" }])}>
                Add stat
              </Button>
            </div>
          </div>

          <div className="space-y-3 rounded-md border border-border p-3">
            <p className="text-small font-medium text-charcoal">Floating badge card</p>
            <div>
              <Label htmlFor="export-hero-badge-eyebrow">Eyebrow</Label>
              <Input id="export-hero-badge-eyebrow" value={values.badgeEyebrow ?? ""} onChange={(event) => set("badgeEyebrow", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="export-hero-badge-headline">Headline</Label>
              <Input id="export-hero-badge-headline" value={values.badgeHeadline ?? ""} onChange={(event) => set("badgeHeadline", event.target.value)} />
            </div>
            <div>
              <Label htmlFor="export-hero-badge-description">Description</Label>
              <Textarea id="export-hero-badge-description" value={values.badgeDescription ?? ""} onChange={(event) => set("badgeDescription", event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="export-hero-badge-cta-label">CTA label</Label>
                <Input id="export-hero-badge-cta-label" value={values.badgeCtaLabel ?? ""} onChange={(event) => set("badgeCtaLabel", event.target.value)} />
              </div>
              <div>
                <Label htmlFor="export-hero-badge-cta-href">CTA destination</Label>
                <Input id="export-hero-badge-cta-href" value={values.badgeCtaHref ?? ""} onChange={(event) => set("badgeCtaHref", event.target.value)} />
              </div>
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSave} disabled={saving}>
            Save
          </Button>
        </SheetFooter>

        <AssetPickerDialog
          open={picker}
          onOpenChange={setPicker}
          onSelect={(asset) => {
            set("backgroundImageUrl", asset.url);
            set("backgroundImageAlt", asset.altText ?? "");
            setPicker(false);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}
