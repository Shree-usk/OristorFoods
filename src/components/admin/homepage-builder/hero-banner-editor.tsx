"use client";

import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { useState } from "react";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  addBanner,
  duplicateBanner,
  removeBanner,
  reorderBanners,
  updateBanner,
  type ContentAlignment,
  type HeroBannerSlide,
  type HeroBannerSlideInput,
  type HomepageSection,
} from "@/lib/api/admin-homepage-builder-client";

interface HeroBannerEditorProps {
  layoutId: string;
  section: HomepageSection;
  draftEditable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

const EMPTY_SLIDE: HeroBannerSlideInput = {
  headline: "",
  subheadline: "",
  supportingText: "",
  ctaLabel: "",
  ctaHref: "",
  secondaryCtaLabel: "",
  secondaryCtaHref: "",
  desktopImageUrl: "",
  desktopImageAlt: "",
  mobileImageUrl: "",
  mobileImageAlt: "",
  videoUrl: "",
  overlayEnabled: false,
  alignment: "Left",
  visible: true,
};

export function HeroBannerEditor({ layoutId, section, draftEditable, open, onOpenChange, onChanged }: HeroBannerEditorProps) {
  const [editingSlide, setEditingSlide] = useState<HeroBannerSlide | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = section.banners.findIndex((s) => s.id === active.id);
    const newIndex = section.banners.findIndex((s) => s.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(section.banners, oldIndex, newIndex);
    try {
      await reorderBanners(layoutId, section.id, reordered.map((s) => s.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reorder banners.");
    } finally {
      onChanged();
    }
  }

  async function handleDuplicate(slideId: string) {
    setError(null);
    try {
      await duplicateBanner(layoutId, section.id, slideId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to duplicate banner.");
    }
  }

  async function handleRemove(slideId: string) {
    setError(null);
    try {
      await removeBanner(layoutId, section.id, slideId);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove banner.");
    }
  }

  const currentSlides = section.banners;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{editingSlide ? (editingSlide === "new" ? "Add banner" : "Edit banner") : "Hero Banner"}</SheetTitle>
        </SheetHeader>

        {error && <p className="px-4 text-small text-chilli">{error}</p>}

        {!editingSlide && (
          <div className="space-y-4 px-4">
            {draftEditable && (
              <Button onClick={() => setEditingSlide("new")} size="sm">
                Add banner
              </Button>
            )}
            {currentSlides.length === 0 && <p className="text-small text-muted-foreground">No banners yet — add one so the Hero Banner section has something to show on the storefront.</p>}
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={currentSlides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <ul className="divide-y divide-border rounded-md border border-border">
                  {currentSlides.map((slide) => (
                    <SortableSlideRow
                      key={slide.id}
                      slide={slide}
                      draftEditable={draftEditable}
                      onEdit={() => setEditingSlide(slide)}
                      onDuplicate={() => handleDuplicate(slide.id)}
                      onRemove={() => handleRemove(slide.id)}
                    />
                  ))}
                </ul>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {editingSlide && (
          <SlideForm
            layoutId={layoutId}
            sectionId={section.id}
            slide={editingSlide === "new" ? null : editingSlide}
            draftEditable={draftEditable}
            onSaved={() => {
              setEditingSlide(null);
              onChanged();
            }}
            onCancel={() => setEditingSlide(null)}
          />
        )}

        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

function SortableSlideRow({
  slide,
  draftEditable,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  slide: HeroBannerSlide;
  draftEditable: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slide.id, disabled: !draftEditable });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };

  return (
    <li ref={setNodeRef} style={style} className="flex items-center justify-between gap-3 p-3">
      <div className="flex items-center gap-2 overflow-hidden">
        {draftEditable && (
          <button type="button" {...attributes} {...listeners} className="cursor-grab text-muted-foreground active:cursor-grabbing" aria-label={`Reorder ${slide.headline}`}>
            <GripVertical className="size-4" />
          </button>
        )}
        <span className="truncate text-small text-charcoal">{slide.headline || "(untitled)"}</span>
        {!slide.visible && <span className="text-small text-muted-foreground">(hidden)</span>}
      </div>
      <div className="flex shrink-0 gap-2">
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
        {draftEditable && (
          <>
            <Button variant="outline" size="sm" onClick={onDuplicate}>
              Duplicate
            </Button>
            <Button variant="destructive" size="sm" onClick={onRemove}>
              Remove
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

function SlideForm({
  layoutId,
  sectionId,
  slide,
  draftEditable,
  onSaved,
  onCancel,
}: {
  layoutId: string;
  sectionId: string;
  slide: HeroBannerSlide | null;
  draftEditable: boolean;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<HeroBannerSlideInput>(
    slide
      ? {
          headline: slide.headline,
          subheadline: slide.subheadline ?? "",
          supportingText: slide.supportingText ?? "",
          ctaLabel: slide.ctaLabel ?? "",
          ctaHref: slide.ctaHref ?? "",
          secondaryCtaLabel: slide.secondaryCtaLabel ?? "",
          secondaryCtaHref: slide.secondaryCtaHref ?? "",
          desktopImageUrl: slide.desktopImageUrl,
          desktopImageAlt: slide.desktopImageAlt,
          mobileImageUrl: slide.mobileImageUrl ?? "",
          mobileImageAlt: slide.mobileImageAlt ?? "",
          videoUrl: slide.videoUrl ?? "",
          overlayEnabled: slide.overlayEnabled,
          alignment: slide.alignment,
          visible: slide.visible,
        }
      : EMPTY_SLIDE,
  );
  const [pickerTarget, setPickerTarget] = useState<"desktop" | "mobile" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof HeroBannerSlideInput>(key: K, value: HeroBannerSlideInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const payload: HeroBannerSlideInput = {
      ...form,
      subheadline: form.subheadline?.trim() || null,
      supportingText: form.supportingText?.trim() || null,
      ctaLabel: form.ctaLabel?.trim() || null,
      ctaHref: form.ctaHref?.trim() || null,
      secondaryCtaLabel: form.secondaryCtaLabel?.trim() || null,
      secondaryCtaHref: form.secondaryCtaHref?.trim() || null,
      mobileImageUrl: form.mobileImageUrl?.trim() || null,
      mobileImageAlt: form.mobileImageAlt?.trim() || null,
      videoUrl: form.videoUrl?.trim() || null,
    };
    try {
      if (slide) await updateBanner(layoutId, sectionId, slide.id, payload);
      else await addBanner(layoutId, sectionId, payload);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save banner.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 overflow-y-auto px-4">
      <CheckboxOption label="Visible" checked={form.visible ?? true} onCheckedChange={(checked) => set("visible", checked)} />

      <div>
        <Label htmlFor="banner-headline">Headline</Label>
        <Input id="banner-headline" value={form.headline} onChange={(event) => set("headline", event.target.value)} disabled={!draftEditable} />
      </div>
      <div>
        <Label htmlFor="banner-subheadline">Subheadline</Label>
        <Input id="banner-subheadline" value={form.subheadline ?? ""} onChange={(event) => set("subheadline", event.target.value)} disabled={!draftEditable} />
      </div>
      <div>
        <Label htmlFor="banner-supporting-text">Supporting text</Label>
        <Input id="banner-supporting-text" value={form.supportingText ?? ""} onChange={(event) => set("supportingText", event.target.value)} disabled={!draftEditable} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="banner-cta-label">CTA label</Label>
          <Input id="banner-cta-label" value={form.ctaLabel ?? ""} onChange={(event) => set("ctaLabel", event.target.value)} disabled={!draftEditable} />
        </div>
        <div>
          <Label htmlFor="banner-cta-href">CTA destination</Label>
          <Input id="banner-cta-href" value={form.ctaHref ?? ""} onChange={(event) => set("ctaHref", event.target.value)} disabled={!draftEditable} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="banner-cta2-label">Secondary CTA label (optional)</Label>
          <Input id="banner-cta2-label" value={form.secondaryCtaLabel ?? ""} onChange={(event) => set("secondaryCtaLabel", event.target.value)} disabled={!draftEditable} />
        </div>
        <div>
          <Label htmlFor="banner-cta2-href">Secondary CTA destination</Label>
          <Input id="banner-cta2-href" value={form.secondaryCtaHref ?? ""} onChange={(event) => set("secondaryCtaHref", event.target.value)} disabled={!draftEditable} />
        </div>
      </div>

      <div>
        <Label htmlFor="banner-desktop-image">Desktop image URL</Label>
        <div className="flex gap-2">
          <Input id="banner-desktop-image" value={form.desktopImageUrl} onChange={(event) => set("desktopImageUrl", event.target.value)} disabled={!draftEditable} />
          {draftEditable && (
            <Button type="button" variant="outline" onClick={() => setPickerTarget("desktop")}>
              Browse Library
            </Button>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="banner-desktop-alt">Desktop image alt text</Label>
        <Input id="banner-desktop-alt" value={form.desktopImageAlt} onChange={(event) => set("desktopImageAlt", event.target.value)} disabled={!draftEditable} />
      </div>

      <div>
        <Label htmlFor="banner-mobile-image">Mobile image URL (optional)</Label>
        <div className="flex gap-2">
          <Input id="banner-mobile-image" value={form.mobileImageUrl ?? ""} onChange={(event) => set("mobileImageUrl", event.target.value)} disabled={!draftEditable} />
          {draftEditable && (
            <Button type="button" variant="outline" onClick={() => setPickerTarget("mobile")}>
              Browse Library
            </Button>
          )}
        </div>
      </div>
      <div>
        <Label htmlFor="banner-mobile-alt">Mobile image alt text</Label>
        <Input id="banner-mobile-alt" value={form.mobileImageAlt ?? ""} onChange={(event) => set("mobileImageAlt", event.target.value)} disabled={!draftEditable} />
      </div>

      <div>
        <Label htmlFor="banner-video">Video URL (optional)</Label>
        <Input id="banner-video" value={form.videoUrl ?? ""} onChange={(event) => set("videoUrl", event.target.value)} disabled={!draftEditable} />
      </div>

      <CheckboxOption label="Show a dark overlay behind the text" checked={form.overlayEnabled ?? false} onCheckedChange={(checked) => set("overlayEnabled", checked)} />

      <div>
        <Label htmlFor="banner-alignment">Content alignment</Label>
        <Select value={form.alignment ?? "Left"} onValueChange={(value) => set("alignment", value as ContentAlignment)}>
          <SelectTrigger id="banner-alignment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Left">Left</SelectItem>
            <SelectItem value="Center">Center</SelectItem>
            <SelectItem value="Right">Right</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {error && <p className="text-small text-chilli">{error}</p>}

      <div className="flex gap-2 pb-4">
        {draftEditable && (
          <Button onClick={handleSave} disabled={saving}>
            {slide ? "Save banner" : "Add banner"}
          </Button>
        )}
        <Button variant="outline" onClick={onCancel}>
          Back
        </Button>
      </div>

      <AssetPickerDialog
        open={pickerTarget !== null}
        onOpenChange={(open) => !open && setPickerTarget(null)}
        onSelect={(asset) => {
          if (pickerTarget === "desktop") {
            set("desktopImageUrl", asset.url);
            if (asset.altText) set("desktopImageAlt", asset.altText);
          } else if (pickerTarget === "mobile") {
            set("mobileImageUrl", asset.url);
            if (asset.altText) set("mobileImageAlt", asset.altText);
          }
          setPickerTarget(null);
        }}
      />
    </div>
  );
}
