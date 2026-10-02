"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HeroBannerSlide } from "@/components/storefront/home/hero-banner-slide";
import {
  changeLandingPageStatusAdmin,
  createLandingPageAdmin,
  createLandingPageBlockAdmin,
  deleteLandingPageBlockAdmin,
  fetchLandingPage,
  reorderLandingPageBlocksAdmin,
  updateLandingPageAdmin,
  updateLandingPageBlockAdmin,
  type ContentAlignmentValue,
  type LandingPageBlock,
  type LandingPageBlockFormInput,
  type LandingPageFormInput,
  type LandingPageStatusValue,
} from "@/lib/api/landing-page-admin-client";

const EMPTY_PAGE: LandingPageFormInput = { name: "", slug: "", metaTitle: null, metaDescription: null };

/**
 * desktopImageUrl/desktopImageAlt are filled in from the asset the admin
 * picks when adding a block (see addBlockPickerOpen below) — a block is
 * never created with an empty image, since both fields are required
 * (mirrors HeroBannerSlide, which a block with no real image could never
 * render meaningfully).
 */
const EMPTY_BLOCK_BASE: Omit<LandingPageBlockFormInput, "desktopImageUrl" | "desktopImageAlt"> = {
  headline: "New block",
  subheadline: null,
  supportingText: null,
  ctaLabel: null,
  ctaHref: null,
  secondaryCtaLabel: null,
  secondaryCtaHref: null,
  mobileImageUrl: null,
  mobileImageAlt: null,
  videoUrl: null,
  overlayEnabled: false,
  alignment: "Left",
};

const STATUS_VARIANT: Record<LandingPageStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "outline",
  Published: "default",
  Archived: "destructive",
};

const ALIGNMENTS: ContentAlignmentValue[] = ["Left", "Center", "Right"];

function BlockEditor({
  block,
  onSaved,
  onDeleted,
  onMove,
  canMoveUp,
  canMoveDown,
}: {
  block: LandingPageBlock;
  onSaved: () => void;
  onDeleted: () => void;
  onMove: (direction: "up" | "down") => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}) {
  const [form, setForm] = useState<LandingPageBlockFormInput & { visible: boolean }>({ ...block });
  const [picker, setPicker] = useState<"desktop" | "mobile" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    setError(null);
    setSaving(true);
    try {
      await updateLandingPageBlockAdmin(block.id, form);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save the block.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-input p-4">
      {error && <p className="mb-2 text-small text-destructive">{error}</p>}
      <div className="flex items-center justify-between">
        <p className="font-medium text-charcoal">{form.headline || "Untitled block"}</p>
        <div className="flex gap-1">
          <Button type="button" size="sm" variant="ghost" disabled={!canMoveUp} onClick={() => onMove("up")}>
            ↑
          </Button>
          <Button type="button" size="sm" variant="ghost" disabled={!canMoveDown} onClick={() => onMove("down")}>
            ↓
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDeleted}>
            Remove
          </Button>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`block-headline-${block.id}`}>Headline</Label>
          <Input id={`block-headline-${block.id}`} value={form.headline} onChange={(event) => setForm({ ...form, headline: event.target.value })} />
        </div>
        <div>
          <Label htmlFor={`block-subheadline-${block.id}`}>Subheadline</Label>
          <Input id={`block-subheadline-${block.id}`} value={form.subheadline ?? ""} onChange={(event) => setForm({ ...form, subheadline: event.target.value || null })} />
        </div>
      </div>

      <Label htmlFor={`block-supporting-${block.id}`} className="mt-3 block">
        Supporting text
      </Label>
      <Input id={`block-supporting-${block.id}`} value={form.supportingText ?? ""} onChange={(event) => setForm({ ...form, supportingText: event.target.value || null })} />

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`block-cta-label-${block.id}`}>CTA label</Label>
          <Input id={`block-cta-label-${block.id}`} value={form.ctaLabel ?? ""} onChange={(event) => setForm({ ...form, ctaLabel: event.target.value || null })} />
        </div>
        <div>
          <Label htmlFor={`block-cta-href-${block.id}`}>CTA link</Label>
          <Input id={`block-cta-href-${block.id}`} value={form.ctaHref ?? ""} onChange={(event) => setForm({ ...form, ctaHref: event.target.value || null })} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor={`block-cta2-label-${block.id}`}>Secondary CTA label</Label>
          <Input id={`block-cta2-label-${block.id}`} value={form.secondaryCtaLabel ?? ""} onChange={(event) => setForm({ ...form, secondaryCtaLabel: event.target.value || null })} />
        </div>
        <div>
          <Label htmlFor={`block-cta2-href-${block.id}`}>Secondary CTA link</Label>
          <Input id={`block-cta2-href-${block.id}`} value={form.secondaryCtaHref ?? ""} onChange={(event) => setForm({ ...form, secondaryCtaHref: event.target.value || null })} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" size="sm" variant="outline" onClick={() => setPicker("desktop")}>
          {form.desktopImageUrl ? "Change desktop image" : "Select desktop image"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setPicker("mobile")}>
          {form.mobileImageUrl ? "Change mobile image" : "Select mobile image (optional)"}
        </Button>
        <Label htmlFor={`block-alignment-${block.id}`} className="ml-auto">
          Alignment
        </Label>
        <Select value={form.alignment} onValueChange={(value) => setForm({ ...form, alignment: value as ContentAlignmentValue })}>
          <SelectTrigger id={`block-alignment-${block.id}`} className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ALIGNMENTS.map((alignment) => (
              <SelectItem key={alignment} value={alignment}>
                {alignment}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-3 flex items-center gap-4">
        <label className="flex items-center gap-2 text-small text-charcoal">
          <Checkbox checked={form.overlayEnabled} onCheckedChange={(checked) => setForm({ ...form, overlayEnabled: checked === true })} />
          Dark overlay
        </label>
        <label className="flex items-center gap-2 text-small text-charcoal">
          <Checkbox checked={form.visible} onCheckedChange={(checked) => setForm({ ...form, visible: checked === true })} />
          Visible
        </label>
      </div>

      <Button type="button" size="sm" className="mt-3" disabled={saving || !form.desktopImageUrl || !form.desktopImageAlt} onClick={save}>
        {saving ? "Saving…" : "Save block"}
      </Button>

      <AssetPickerDialog
        open={picker !== null}
        onOpenChange={(open) => !open && setPicker(null)}
        onSelect={(asset) => {
          if (picker === "desktop") {
            setForm((current) => ({ ...current, desktopImageUrl: asset.url, desktopImageAlt: asset.altText ?? "" }));
          } else if (picker === "mobile") {
            setForm((current) => ({ ...current, mobileImageUrl: asset.url, mobileImageAlt: asset.altText ?? "" }));
          }
          setPicker(null);
        }}
      />
    </div>
  );
}

export function AdminLandingPageEditorView({ landingPageId }: { landingPageId: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewMobile, setPreviewMobile] = useState(false);
  const [addBlockPickerOpen, setAddBlockPickerOpen] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["admin-landing-page", landingPageId],
    queryFn: () => fetchLandingPage(landingPageId!),
    enabled: Boolean(landingPageId),
    refetchOnWindowFocus: false,
  });

  const { register, handleSubmit, reset } = useForm<LandingPageFormInput>({ defaultValues: EMPTY_PAGE });

  const seeded = useRef(false);
  useEffect(() => {
    if (!existing || seeded.current) return;
    seeded.current = true;
    reset(existing);
  }, [existing, reset]);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-landing-page", landingPageId] });
  }

  const onSubmit = handleSubmit(async (values) => {
    setActionError(null);
    setSaved(false);
    try {
      if (landingPageId) {
        await updateLandingPageAdmin(landingPageId, values);
        invalidate();
        setSaved(true);
      } else {
        const created = await createLandingPageAdmin(values);
        router.push(`/admin/marketing/landing-pages/${created.id}`);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the landing page.");
    }
  });

  async function runStatusChange(status: LandingPageStatusValue) {
    if (!landingPageId) return;
    setActionError(null);
    try {
      await changeLandingPageStatusAdmin(landingPageId, status);
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to change status.");
    }
  }

  async function addBlockWithImage(desktopImageUrl: string, desktopImageAlt: string) {
    if (!landingPageId) return;
    setActionError(null);
    try {
      await createLandingPageBlockAdmin(landingPageId, { ...EMPTY_BLOCK_BASE, desktopImageUrl, desktopImageAlt });
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to add a block.");
    }
  }

  async function removeBlock(blockId: string) {
    setActionError(null);
    try {
      await deleteLandingPageBlockAdmin(blockId);
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to remove the block.");
    }
  }

  async function moveBlock(index: number, direction: "up" | "down") {
    if (!existing || !landingPageId) return;
    const blocks = [...existing.blocks];
    const swapWith = direction === "up" ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= blocks.length) return;
    [blocks[index], blocks[swapWith]] = [blocks[swapWith], blocks[index]];
    setActionError(null);
    try {
      await reorderLandingPageBlocksAdmin(landingPageId, blocks.map((block) => block.id));
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to reorder blocks.");
    }
  }

  const visibleBlocksForPreview = (existing?.blocks ?? []).filter((block) => block.visible);

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">{landingPageId ? "Edit Landing Page" : "New Landing Page"}</h1>
          {existing && (
            <div className="mt-1 flex items-center gap-2">
              <Badge variant={STATUS_VARIANT[existing.status]}>{existing.status}</Badge>
              <span className="text-small text-charcoal/60">/landing/{existing.slug}</span>
            </div>
          )}
        </div>
        {existing && visibleBlocksForPreview.length > 0 && (
          <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
            Preview
          </Button>
        )}
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}
      {saved && <p className="mt-3 text-small text-charcoal/70">Saved.</p>}

      {landingPageId && existing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {(existing.status === "Draft" || existing.status === "Archived") && (
            <Button type="button" size="sm" onClick={() => runStatusChange("Published")}>
              Publish
            </Button>
          )}
          {existing.status === "Archived" && (
            <Button type="button" size="sm" variant="outline" onClick={() => runStatusChange("Draft")}>
              Move back to Draft
            </Button>
          )}
          {existing.status !== "Archived" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => runStatusChange("Archived")}>
              Archive
            </Button>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 max-w-xl space-y-4">
        <div>
          <Label htmlFor="landing-page-name">Internal name</Label>
          <Input id="landing-page-name" {...register("name")} placeholder="October Sale Landing Page" />
        </div>
        <div>
          <Label htmlFor="landing-page-slug">URL slug</Label>
          <Input id="landing-page-slug" {...register("slug")} placeholder="october-sale" />
        </div>
        <div>
          <Label htmlFor="landing-page-meta-title">Meta title (optional)</Label>
          <Input id="landing-page-meta-title" {...register("metaTitle")} />
        </div>
        <div>
          <Label htmlFor="landing-page-meta-description">Meta description (optional)</Label>
          <Input id="landing-page-meta-description" {...register("metaDescription")} />
        </div>
        <Button type="submit">{landingPageId ? "Save" : "Create"}</Button>
      </form>

      {landingPageId && existing && (
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h2 className="text-h4 font-heading text-charcoal">Content blocks</h2>
            <Button type="button" size="sm" onClick={() => setAddBlockPickerOpen(true)}>
              Add block
            </Button>
          </div>
          <div className="mt-3 space-y-3">
            {existing.blocks.length === 0 && <p className="text-small text-charcoal/60">No blocks yet — add one to give this page a hero.</p>}
            {existing.blocks.map((block, index) => (
              <BlockEditor
                key={block.id}
                block={block}
                onSaved={invalidate}
                onDeleted={() => removeBlock(block.id)}
                onMove={(direction) => moveBlock(index, direction)}
                canMoveUp={index > 0}
                canMoveDown={index < existing.blocks.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      <AssetPickerDialog
        open={addBlockPickerOpen}
        onOpenChange={setAddBlockPickerOpen}
        onSelect={(asset) => {
          setAddBlockPickerOpen(false);
          addBlockWithImage(asset.url, asset.altText ?? "");
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <h2 className="text-h4 font-heading text-charcoal">Preview</h2>
          <div className="mt-2 flex gap-2">
            <Button type="button" size="sm" variant={previewMobile ? "outline" : "default"} onClick={() => setPreviewMobile(false)}>
              Desktop
            </Button>
            <Button type="button" size="sm" variant={previewMobile ? "default" : "outline"} onClick={() => setPreviewMobile(true)}>
              Mobile
            </Button>
          </div>
          <div className={previewMobile ? "mx-auto mt-3 w-[375px] overflow-hidden rounded-lg border" : "mt-3 overflow-hidden rounded-lg border"}>
            {visibleBlocksForPreview.map((block) => (
              <HeroBannerSlide
                key={block.id}
                data={{
                  headline: block.headline,
                  subheadline: block.subheadline,
                  supportingText: block.supportingText,
                  ctaLabel: block.ctaLabel,
                  ctaHref: block.ctaHref,
                  secondaryCtaLabel: block.secondaryCtaLabel,
                  secondaryCtaHref: block.secondaryCtaHref,
                  desktopImageUrl: block.desktopImageUrl,
                  desktopImageAlt: block.desktopImageAlt,
                  mobileImageUrl: block.mobileImageUrl,
                  mobileImageAlt: block.mobileImageAlt,
                  videoUrl: block.videoUrl,
                  overlayEnabled: block.overlayEnabled,
                  alignment: block.alignment,
                }}
              />
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
