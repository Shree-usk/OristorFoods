"use client";

import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { computeSeoHealth } from "@/lib/seo-health";
import { fetchSeoMeta, updateSeoMetaAdmin, type SeoEntityTypeValue, type SeoMetaFormInput } from "@/lib/api/seo-admin-client";

const EMPTY_VALUES: SeoMetaFormInput = {
  metaTitle: null,
  metaDescription: null,
  canonicalUrl: null,
  ogImageUrl: null,
  ogImageAlt: null,
  ogImageWidth: null,
  ogImageHeight: null,
  robotsIndex: true,
  robotsFollow: true,
  focusKeyword: null,
  jsonLdOverride: null,
};

/**
 * STORY-051a. Self-contained — fetches and saves its own SeoMeta row via
 * its own API/client, completely decoupled from the parent form's (Product/
 * Recipe/BlogPost) own save flow. When entityId is null (the entity hasn't
 * been created yet), renders a placeholder instead — the same
 * conditional-render-until-an-id-exists pattern the Popup editor's status
 * actions and performance panel already use.
 */
export function SeoFieldsPanel({ entityType, entityId }: { entityType: SeoEntityTypeValue; entityId: string | null }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);
  // The textarea edits raw JSON text, not the parsed value react-hook-form
  // holds — kept as separate local state so a mid-edit keystroke never has
  // to be valid JSON, only the value at save time does.
  const [jsonLdText, setJsonLdText] = useState("");
  const [jsonLdError, setJsonLdError] = useState<string | null>(null);

  const { data: existing } = useQuery({
    queryKey: ["admin-seo-meta", entityType, entityId],
    queryFn: () => fetchSeoMeta(entityType, entityId!),
    enabled: Boolean(entityId),
    refetchOnWindowFocus: false,
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<SeoMetaFormInput>({ defaultValues: EMPTY_VALUES });

  const seeded = useRef(false);
  useEffect(() => {
    if (!existing || seeded.current) return;
    seeded.current = true;
    reset(existing);
    setJsonLdText(existing.jsonLdOverride ? JSON.stringify(existing.jsonLdOverride, null, 2) : "");
  }, [existing, reset]);

  const formValues = watch();
  const health = computeSeoHealth(formValues);

  // A plain handleSubmit callback, not a <form onSubmit> — this panel is
  // embedded inside each content type's own <form> (Product/Recipe/Blog),
  // and a nested <form> is invalid HTML (React logs a hydration error and
  // the native submit/button semantics break across the two forms).
  const onSave = handleSubmit(async (values) => {
    if (!entityId) return;
    setError(null);
    setJsonLdError(null);
    setSaved(false);

    let jsonLdOverride: unknown = null;
    if (jsonLdText.trim()) {
      try {
        jsonLdOverride = JSON.parse(jsonLdText);
      } catch {
        setJsonLdError("Invalid JSON — fix it before saving, or clear the field to remove the override.");
        return;
      }
    }

    try {
      await updateSeoMetaAdmin(entityType, entityId, { ...values, jsonLdOverride });
      queryClient.invalidateQueries({ queryKey: ["admin-seo-meta", entityType, entityId] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the SEO fields.");
    }
  });

  if (!entityId) {
    return <p className="text-small text-charcoal/60">Save this page first to manage its SEO fields.</p>;
  }

  return (
    <div>
      {error && <p className="mb-3 text-small text-destructive">{error}</p>}
      {saved && <p className="mb-3 text-small text-charcoal/70">Saved.</p>}

      <div className="mb-4 rounded border border-input p-3">
        <p className="text-small font-medium text-charcoal">SEO health</p>
        <ul className="mt-1 space-y-1 text-small">
          {health.map((check) => (
            <li key={check.id} className={check.ok ? "text-charcoal/70" : "text-destructive"}>
              {check.ok ? "✓" : "✗"} {check.label}
            </li>
          ))}
        </ul>
      </div>

      <div className="grid gap-4">
        <div>
          <Label htmlFor="seo-meta-title">Meta title</Label>
          <Input id="seo-meta-title" {...register("metaTitle")} />
        </div>
        <div>
          <Label htmlFor="seo-meta-description">Meta description</Label>
          <Textarea id="seo-meta-description" {...register("metaDescription")} />
        </div>
        <div>
          <Label htmlFor="seo-canonical-url">Canonical URL</Label>
          <Input id="seo-canonical-url" {...register("canonicalUrl")} />
        </div>
        <div>
          <Label htmlFor="seo-focus-keyword">Focus keyword</Label>
          <Input id="seo-focus-keyword" {...register("focusKeyword")} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
            {formValues.ogImageUrl ? "Change social share image" : "Choose social share image"}
          </Button>
          {formValues.ogImageUrl && <span className="text-small text-charcoal/60">{formValues.ogImageAlt}</span>}
        </div>

        <div className="flex gap-6">
          <div className="flex items-center gap-2">
            <Checkbox checked={formValues.robotsIndex} onCheckedChange={(checked) => setValue("robotsIndex", checked === true)} id="seo-robots-index" />
            <Label htmlFor="seo-robots-index">Index (show in search results)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox checked={formValues.robotsFollow} onCheckedChange={(checked) => setValue("robotsFollow", checked === true)} id="seo-robots-follow" />
            <Label htmlFor="seo-robots-follow">Follow links</Label>
          </div>
        </div>

        <div>
          <Label htmlFor="seo-json-ld-override">Advanced: custom structured data (JSON-LD)</Label>
          <p className="mb-1 text-small text-charcoal/60">
            Optional. When set, this completely replaces the page&apos;s auto-generated structured data — leave blank to use the default.
          </p>
          <Textarea
            id="seo-json-ld-override"
            rows={6}
            className="font-mono text-small"
            placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "Product",\n  ...\n}'}
            value={jsonLdText}
            onChange={(event) => {
              setJsonLdText(event.target.value);
              setJsonLdError(null);
            }}
          />
          {jsonLdError && <p className="mt-1 text-small text-destructive">{jsonLdError}</p>}
        </div>

        <Button type="button" className="mt-2 w-fit" onClick={onSave}>
          Save SEO fields
        </Button>
      </div>

      <AssetPickerDialog
        open={picker}
        onOpenChange={setPicker}
        onSelect={(asset) => {
          setValue("ogImageUrl", asset.url);
          setValue("ogImageAlt", asset.altText ?? "");
          setValue("ogImageWidth", asset.width);
          setValue("ogImageHeight", asset.height);
          setPicker(false);
        }}
      />
    </div>
  );
}
