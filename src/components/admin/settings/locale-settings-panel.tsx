"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchLocaleSetting, updateLocaleSetting } from "@/lib/api/admin-system-settings-client";

export function LocaleSettingsPanel() {
  const queryClient = useQueryClient();
  const [defaultLocale, setDefaultLocale] = useState("en");
  const [supportedLocales, setSupportedLocales] = useState("en");
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-settings-locales"], queryFn: fetchLocaleSetting });

  if (data && !seeded) {
    setSeeded(true);
    setDefaultLocale(data.defaultLocale);
    setSupportedLocales(data.supportedLocales.join(", "));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await updateLocaleSetting({
        defaultLocale: defaultLocale.trim(),
        supportedLocales: supportedLocales.split(",").map((code) => code.trim()).filter(Boolean),
      });
      queryClient.invalidateQueries({ queryKey: ["admin-settings-locales"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save locale settings.");
    }
  }

  return (
    <div className="grid max-w-md gap-4">
      {error && <p className="text-small text-destructive">{error}</p>}
      {saved && <p className="text-small text-charcoal/70">Saved.</p>}

      <div>
        <Label htmlFor="locale-default">Default locale</Label>
        <Input id="locale-default" value={defaultLocale} onChange={(event) => setDefaultLocale(event.target.value)} />
      </div>
      <div>
        <Label htmlFor="locale-supported">Supported locales (comma-separated)</Label>
        <Input id="locale-supported" value={supportedLocales} onChange={(event) => setSupportedLocales(event.target.value)} placeholder="en, si, ta" />
      </div>

      <Button type="button" className="w-fit" onClick={handleSave}>
        Save
      </Button>
    </div>
  );
}
