"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import {
  fetchAnnouncementBarSetting,
  updateAnnouncementBarSetting,
  type AnnouncementBarSettingInput,
} from "@/lib/api/admin-system-settings-client";

const EMPTY_VALUES: AnnouncementBarSettingInput = {
  message: "",
  linkLabel: "",
  linkHref: "",
  isEnabled: false,
};

/**
 * Header/Nav redesign. Self-contained (own fetch+save), same pattern as
 * CompanySettingsPanel. Hidden on the storefront until isEnabled is on
 * AND message is set — see system-settings.service.ts::getResolvedAnnouncementBar.
 */
export function AnnouncementBarSettingsPanel() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<AnnouncementBarSettingInput>(EMPTY_VALUES);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-settings-announcement-bar"], queryFn: fetchAnnouncementBarSetting });

  if (data && !seeded) {
    setSeeded(true);
    setValues({
      message: data.message ?? "",
      linkLabel: data.linkLabel ?? "",
      linkHref: data.linkHref ?? "",
      isEnabled: data.isEnabled,
    });
  }

  function setField<K extends keyof AnnouncementBarSettingInput>(key: K, value: AnnouncementBarSettingInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await updateAnnouncementBarSetting(values);
      queryClient.invalidateQueries({ queryKey: ["admin-settings-announcement-bar"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save announcement bar settings.");
    }
  }

  return (
    <div className="grid max-w-2xl gap-4">
      {error && <p className="text-small text-destructive">{error}</p>}
      {saved && <p className="text-small text-charcoal/70">Saved.</p>}

      <p className="text-small text-charcoal/70">
        A thin strip shown above the header on every page. Leave &quot;Show on the site&quot; off, or the message
        empty, to hide it entirely.
      </p>

      <CheckboxOption
        label="Show on the site"
        checked={values.isEnabled ?? false}
        onCheckedChange={(checked) => setField("isEnabled", checked)}
      />

      <div>
        <Label htmlFor="announcement-message">Message</Label>
        <Input
          id="announcement-message"
          maxLength={200}
          placeholder="Authentic Sri Lankan flavours, made with care."
          value={values.message ?? ""}
          onChange={(event) => setField("message", event.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="announcement-link-label">Link label (optional)</Label>
          <Input
            id="announcement-link-label"
            placeholder="Shop now"
            value={values.linkLabel ?? ""}
            onChange={(event) => setField("linkLabel", event.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="announcement-link-href">Link destination (optional)</Label>
          <Input
            id="announcement-link-href"
            placeholder="/products"
            value={values.linkHref ?? ""}
            onChange={(event) => setField("linkHref", event.target.value)}
          />
        </div>
      </div>

      <Button type="button" className="w-fit" onClick={handleSave}>
        Save
      </Button>
    </div>
  );
}
