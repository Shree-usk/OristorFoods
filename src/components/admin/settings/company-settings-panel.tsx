"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { fetchCompanySetting, updateCompanySetting, type CompanySettingInput } from "@/lib/api/admin-system-settings-client";

const EMPTY_VALUES: CompanySettingInput = {
  legalName: "",
  brandName: "",
  logoUrl: "",
  logoAlt: "",
  address: "",
  phone: "",
  email: "",
  businessRegistrationId: "",
  taxId: "",
  socialLinks: [],
};

/**
 * STORY-054. Self-contained (own fetch+save), same pattern
 * SeoFieldsPanel established. Replaces footer-config.ts's hardcoded
 * `contactInfo` — see system-settings.service.ts::getResolvedCompanyInfo
 * for the storefront footer's own fallback-until-saved read.
 */
export function CompanySettingsPanel() {
  const queryClient = useQueryClient();
  const [values, setValues] = useState<CompanySettingInput>(EMPTY_VALUES);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState(false);

  const { data } = useQuery({ queryKey: ["admin-settings-company"], queryFn: fetchCompanySetting });

  if (data && !seeded) {
    setSeeded(true);
    setValues({
      legalName: data.legalName ?? "",
      brandName: data.brandName ?? "",
      logoUrl: data.logoUrl ?? "",
      logoAlt: data.logoAlt ?? "",
      address: data.address ?? "",
      phone: data.phone ?? "",
      email: data.email ?? "",
      businessRegistrationId: data.businessRegistrationId ?? "",
      taxId: data.taxId ?? "",
      socialLinks: data.socialLinks ?? [],
    });
  }

  function setField<K extends keyof CompanySettingInput>(key: K, value: CompanySettingInput[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setError(null);
    setSaved(false);
    try {
      await updateCompanySetting(values);
      queryClient.invalidateQueries({ queryKey: ["admin-settings-company"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save company settings.");
    }
  }

  const socialLinks = values.socialLinks ?? [];

  return (
    <div className="grid gap-4 max-w-2xl">
      {error && <p className="text-small text-destructive">{error}</p>}
      {saved && <p className="text-small text-charcoal/70">Saved.</p>}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="company-legal-name">Legal name</Label>
          <Input id="company-legal-name" value={values.legalName ?? ""} onChange={(event) => setField("legalName", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="company-brand-name">Brand name</Label>
          <Input id="company-brand-name" value={values.brandName ?? ""} onChange={(event) => setField("brandName", event.target.value)} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
          {values.logoUrl ? "Change logo" : "Choose logo"}
        </Button>
        {values.logoUrl && <span className="text-small text-charcoal/60">{values.logoAlt}</span>}
      </div>

      <div>
        <Label htmlFor="company-address">Registered address</Label>
        <Textarea id="company-address" value={values.address ?? ""} onChange={(event) => setField("address", event.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="company-phone">Phone</Label>
          <Input id="company-phone" value={values.phone ?? ""} onChange={(event) => setField("phone", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="company-email">Email</Label>
          <Input id="company-email" type="email" value={values.email ?? ""} onChange={(event) => setField("email", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="company-registration-id">Business registration ID</Label>
          <Input id="company-registration-id" value={values.businessRegistrationId ?? ""} onChange={(event) => setField("businessRegistrationId", event.target.value)} />
        </div>
        <div>
          <Label htmlFor="company-tax-id">Tax ID</Label>
          <Input id="company-tax-id" value={values.taxId ?? ""} onChange={(event) => setField("taxId", event.target.value)} />
        </div>
      </div>

      <div>
        <Label>Social links</Label>
        <div className="mt-1 space-y-2">
          {socialLinks.map((link, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Label (e.g. Facebook)"
                value={link.label}
                onChange={(event) => setField("socialLinks", socialLinks.map((entry, i) => (i === index ? { ...entry, label: event.target.value } : entry)))}
              />
              <Input
                placeholder="https://..."
                value={link.href}
                onChange={(event) => setField("socialLinks", socialLinks.map((entry, i) => (i === index ? { ...entry, href: event.target.value } : entry)))}
              />
              <Button type="button" variant="outline" size="sm" onClick={() => setField("socialLinks", socialLinks.filter((_, i) => i !== index))}>
                Remove
              </Button>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setField("socialLinks", [...socialLinks, { label: "", href: "" }])}>
            Add social link
          </Button>
        </div>
      </div>

      <Button type="button" className="w-fit" onClick={handleSave}>
        Save
      </Button>

      <AssetPickerDialog
        open={picker}
        onOpenChange={setPicker}
        onSelect={(asset) => {
          setField("logoUrl", asset.url);
          setField("logoAlt", asset.altText ?? "");
          setPicker(false);
        }}
      />
    </div>
  );
}
