"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { fetchExportCatalogueSetting, updateExportCatalogueSetting, type ExportCatalogueSetting, type ExportCatalogueSettingInput } from "@/lib/api/admin-export-catalogue-client";
import { toastManager } from "@/lib/toast";

const EMPTY_FORM: ExportCatalogueSettingInput = { title: "", introText: "", showPricing: false };

export function AdminExportCatalogueSettingsPanel() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-export-catalogue-settings"], queryFn: fetchExportCatalogueSetting });
  const [form, setForm] = useState<ExportCatalogueSettingInput>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seeds the form from the query exactly once it resolves — a render-phase
  // state update (React's documented replacement for "adjust state when a
  // prop changes" via useEffect, which the lint rule here flags as a
  // cascading-render risk) rather than a `useEffect` + `setState`.
  const [seededFrom, setSeededFrom] = useState<ExportCatalogueSetting | null | undefined>(undefined);
  if (data !== undefined && data !== seededFrom) {
    setSeededFrom(data);
    setForm(data ? { title: data.title ?? "", introText: data.introText ?? "", showPricing: data.showPricing } : EMPTY_FORM);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await updateExportCatalogueSetting(form);
      toastManager.add({ title: "Catalogue settings saved" });
      queryClient.invalidateQueries({ queryKey: ["admin-export-catalogue-settings"] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save catalogue settings.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="grid max-w-2xl gap-4">
      <h1 className="text-h2 font-heading text-charcoal">Export Catalogue Settings</h1>
      <p className="text-small text-charcoal/70">
        Company name, address, phone, and logo come from System Settings and are never duplicated here.
      </p>

      {error && <p className="text-small text-destructive">{error}</p>}

      <div>
        <Label htmlFor="catalogue-title">Catalogue title (optional)</Label>
        <Input
          id="catalogue-title"
          placeholder="Export & Wholesale Catalogue"
          value={form.title ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
        />
      </div>
      <div>
        <Label htmlFor="catalogue-intro">Intro text (optional)</Label>
        <Textarea
          id="catalogue-intro"
          rows={4}
          value={form.introText ?? ""}
          onChange={(event) => setForm((prev) => ({ ...prev, introText: event.target.value }))}
        />
      </div>
      <div className="pt-1">
        <CheckboxOption
          label="Show pricing on the public catalogue"
          checked={form.showPricing ?? false}
          onCheckedChange={(checked) => setForm((prev) => ({ ...prev, showPricing: checked }))}
          disabled
        />
        <p className="mt-1 text-caption text-charcoal/60">
          Not yet implemented — deferred during the staging acceptance review. Turning this on has no visible effect on the public
          catalogue today; nothing invents an export price or exposes retail pricing to anonymous buyers. The public export
          catalogue is unauthenticated, so publishing any price here would mean publishing it to every visitor with no login and no
          way to scope it to a buyer type — a pricing-strategy decision for the business, not something to default on. The field is
          still saved so an earlier choice isn&apos;t lost once this is built.
        </p>
      </div>

      <div>
        <Button type="button" onClick={handleSave} disabled={isSaving}>
          {isSaving ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </div>
  );
}
