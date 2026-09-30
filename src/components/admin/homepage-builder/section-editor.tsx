"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { SECTION_TYPE_LABELS } from "@/components/admin/homepage-builder/section-labels";
import { updateSection, type HomepageSection } from "@/lib/api/admin-homepage-builder-client";

interface SectionEditorProps {
  layoutId: string;
  section: HomepageSection;
  draftEditable: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

/**
 * The light-touch editor for the 10 non-HeroBanner types this pass:
 * visible toggle + an optional title/description override. Their actual
 * content keeps coming from fixtures/real per-story data — no
 * section-specific editors yet (deferred, see docs/architecture-decisions.md).
 */
export function SectionEditor({ layoutId, section, draftEditable, open, onOpenChange, onChanged }: SectionEditorProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{SECTION_TYPE_LABELS[section.type]}</SheetTitle>
        </SheetHeader>
        <SectionEditorForm key={section.id} layoutId={layoutId} section={section} draftEditable={draftEditable} onChanged={onChanged} onClose={() => onOpenChange(false)} />
        <SheetFooter />
      </SheetContent>
    </Sheet>
  );
}

function SectionEditorForm({
  layoutId,
  section,
  draftEditable,
  onChanged,
  onClose,
}: {
  layoutId: string;
  section: HomepageSection;
  draftEditable: boolean;
  onChanged: () => void;
  onClose: () => void;
}) {
  const [titleOverride, setTitleOverride] = useState(section.titleOverride ?? "");
  const [descriptionOverride, setDescriptionOverride] = useState(section.descriptionOverride ?? "");
  const [visible, setVisible] = useState(section.visible);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      await updateSection(layoutId, section.id, {
        visible,
        titleOverride: titleOverride.trim() || null,
        descriptionOverride: descriptionOverride.trim() || null,
      });
      onChanged();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 px-4">
      <CheckboxOption label="Visible on the storefront" checked={visible} onCheckedChange={setVisible} />
      <div>
        <Label htmlFor="section-title-override">Title override</Label>
        <Input id="section-title-override" value={titleOverride} onChange={(event) => setTitleOverride(event.target.value)} placeholder="Leave blank to use the default heading" disabled={!draftEditable} />
      </div>
      <div>
        <Label htmlFor="section-description-override">Description override</Label>
        <Input id="section-description-override" value={descriptionOverride} onChange={(event) => setDescriptionOverride(event.target.value)} placeholder="Leave blank to use the default" disabled={!draftEditable} />
      </div>
      {error && <p className="text-small text-chilli">{error}</p>}
      {draftEditable && (
        <Button onClick={handleSave} disabled={saving}>
          Save
        </Button>
      )}
    </div>
  );
}
