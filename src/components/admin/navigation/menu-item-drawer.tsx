"use client";

import { useState } from "react";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { MENU_ICON_OPTIONS } from "@/lib/menu-icons";
import { createMenuItem, updateMenuItem, type MenuContentBlockTypeValue, type MenuItem, type MenuItemInput, type MenuItemVisibilityValue, type MenuLinkTypeValue, type MenuLocationValue } from "@/lib/api/admin-navigation-client";

const EMPTY_ITEM: MenuItemInput = {
  parentId: null,
  label: "",
  linkType: "Internal",
  internalPath: "",
  externalUrl: null,
  openInNewTab: false,
  icon: null,
  visibility: "Always",
  targetCustomerGroup: null,
  active: true,
  contentBlockType: "Link",
  promoImageUrl: null,
  promoImageAlt: null,
  promoHeading: null,
  promoCtaLabel: null,
};

interface MenuItemDrawerProps {
  location: MenuLocationValue;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The item being edited, "new" to create one, or null/closed. */
  target: MenuItem | { parentId: string | null } | null;
  /** Mega-menu children (Header, depth 2) may be a promo tile instead of a plain link — every other depth is link-only. */
  allowPromoTile: boolean;
  onChanged: () => void;
}

function targetKey(target: MenuItemDrawerProps["target"]): string {
  if (!target) return "none";
  return "id" in target ? target.id : `new:${target.parentId ?? "root"}`;
}

function valuesFromTarget(target: MenuItemDrawerProps["target"]): MenuItemInput {
  if (!target) return EMPTY_ITEM;
  if ("id" in target) {
    return {
      parentId: target.parentId,
      label: target.label,
      linkType: target.linkType,
      internalPath: target.internalPath,
      externalUrl: target.externalUrl,
      openInNewTab: target.openInNewTab,
      icon: target.icon,
      visibility: target.visibility,
      targetCustomerGroup: target.targetCustomerGroup,
      active: target.active,
      contentBlockType: target.contentBlockType,
      promoImageUrl: target.promoImageUrl,
      promoImageAlt: target.promoImageAlt,
      promoHeading: target.promoHeading,
      promoCtaLabel: target.promoCtaLabel,
    };
  }
  return { ...EMPTY_ITEM, parentId: target.parentId };
}

export function MenuItemDrawer({ location, open, onOpenChange, target, allowPromoTile, onChanged }: MenuItemDrawerProps) {
  const [values, setValues] = useState<MenuItemInput>(() => valuesFromTarget(target));
  const [error, setError] = useState<string | null>(null);
  const [picker, setPicker] = useState(false);

  // Re-seed the form whenever a different item (or "new" marker) is opened —
  // adjusting state during render in response to a changed prop, same
  // pattern mobile-nav.tsx uses for its own route-change reset, rather than
  // a useEffect (which would cause an extra, avoidable render).
  const [seededKey, setSeededKey] = useState(() => targetKey(target));
  const currentKey = targetKey(target);
  if (currentKey !== seededKey) {
    setSeededKey(currentKey);
    setValues(valuesFromTarget(target));
    setError(null);
  }

  const isEditing = target !== null && "id" in target;

  async function handleSave() {
    setError(null);
    try {
      if (isEditing && target && "id" in target) {
        await updateMenuItem(location, target.id, values);
      } else {
        await createMenuItem(location, values);
      }
      onChanged();
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save this item.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit item" : "Add item"}</SheetTitle>
        </SheetHeader>

        <div className="grid gap-4 px-4">
          {error && <p className="text-small text-destructive">{error}</p>}

          <div>
            <Label htmlFor="menu-item-label">Label</Label>
            <Input id="menu-item-label" value={values.label} onChange={(event) => setValues((prev) => ({ ...prev, label: event.target.value }))} />
          </div>

          <div>
            <Label>Link type</Label>
            <Select value={values.linkType} onValueChange={(value) => setValues((prev) => ({ ...prev, linkType: value as MenuLinkTypeValue, internalPath: value === "Internal" ? prev.internalPath : null, externalUrl: value === "External" ? prev.externalUrl : null }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Internal">Internal path</SelectItem>
                <SelectItem value="External">External URL</SelectItem>
                <SelectItem value="None">Grouping only (not clickable)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.linkType === "Internal" && (
            <div>
              <Label htmlFor="menu-item-internal-path">Internal path</Label>
              <Input id="menu-item-internal-path" placeholder="/products" value={values.internalPath ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, internalPath: event.target.value }))} />
            </div>
          )}

          {values.linkType === "External" && (
            <div>
              <Label htmlFor="menu-item-external-url">External URL</Label>
              <Input id="menu-item-external-url" placeholder="https://example.com" value={values.externalUrl ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, externalUrl: event.target.value }))} />
            </div>
          )}

          {values.linkType !== "None" && <CheckboxOption label="Open in a new tab" checked={values.openInNewTab} onCheckedChange={(checked) => setValues((prev) => ({ ...prev, openInNewTab: checked }))} />}

          <div>
            <Label>Icon</Label>
            <Select value={values.icon ?? "none"} onValueChange={(value) => setValues((prev) => ({ ...prev, icon: value === "none" ? null : value }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No icon</SelectItem>
                {Object.keys(MENU_ICON_OPTIONS).map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Visibility</Label>
            <Select value={values.visibility} onValueChange={(value) => setValues((prev) => ({ ...prev, visibility: value as MenuItemVisibilityValue, targetCustomerGroup: value === "CustomerGroupTarget" ? prev.targetCustomerGroup : null }))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Always">Always visible</SelectItem>
                <SelectItem value="Authenticated">Signed-in customers only</SelectItem>
                <SelectItem value="CustomerGroupTarget">A specific customer group only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {values.visibility === "CustomerGroupTarget" && (
            <div>
              <Label>Customer group</Label>
              <Select value={values.targetCustomerGroup ?? ""} onValueChange={(value) => setValues((prev) => ({ ...prev, targetCustomerGroup: value as MenuItemInput["targetCustomerGroup"] }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Retail">Retail</SelectItem>
                  <SelectItem value="Wholesale">Wholesale</SelectItem>
                  <SelectItem value="Distributor">Distributor</SelectItem>
                  <SelectItem value="Export">Export</SelectItem>
                  <SelectItem value="PrivateLabel">Private Label</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <CheckboxOption label="Active" checked={values.active} onCheckedChange={(checked) => setValues((prev) => ({ ...prev, active: checked }))} />

          {allowPromoTile && (
            <>
              <div>
                <Label>Content block</Label>
                <Select value={values.contentBlockType} onValueChange={(value) => setValues((prev) => ({ ...prev, contentBlockType: value as MenuContentBlockTypeValue }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Link">Plain link</SelectItem>
                    <SelectItem value="PromoTile">Promo tile (image + CTA)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {values.contentBlockType === "PromoTile" && (
                <>
                  <div className="flex items-center gap-3">
                    <Button type="button" variant="outline" size="sm" onClick={() => setPicker(true)}>
                      {values.promoImageUrl ? "Change promo image" : "Choose promo image"}
                    </Button>
                    {values.promoImageUrl && <span className="text-small text-charcoal/60">{values.promoImageAlt}</span>}
                  </div>
                  <div>
                    <Label htmlFor="menu-item-promo-heading">Promo heading</Label>
                    <Input id="menu-item-promo-heading" value={values.promoHeading ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, promoHeading: event.target.value }))} />
                  </div>
                  <div>
                    <Label htmlFor="menu-item-promo-cta">Promo CTA label</Label>
                    <Input id="menu-item-promo-cta" value={values.promoCtaLabel ?? ""} onChange={(event) => setValues((prev) => ({ ...prev, promoCtaLabel: event.target.value }))} />
                  </div>
                </>
              )}
            </>
          )}
        </div>

        <SheetFooter>
          <Button onClick={handleSave}>Save</Button>
        </SheetFooter>
      </SheetContent>

      <AssetPickerDialog
        open={picker}
        onOpenChange={setPicker}
        onSelect={(asset) => {
          setValues((prev) => ({ ...prev, promoImageUrl: asset.url, promoImageAlt: asset.altText ?? "" }));
          setPicker(false);
        }}
      />
    </Sheet>
  );
}
