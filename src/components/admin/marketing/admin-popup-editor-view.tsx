"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PopupOverlay } from "@/components/storefront/popup/popup-overlay";
import {
  changePopupStatusAdmin,
  createPopupAdmin,
  fetchPopup,
  fetchPopupPerformance,
  updatePopupAdmin,
  type CustomerGroupValue,
  type PopupAudienceTargetValue,
  type PopupFormInput,
  type PopupFrequencyCapValue,
  type PopupPageTargetValue,
  type PopupStatusValue,
  type PopupTriggerTypeValue,
} from "@/lib/api/popup-admin-client";

const PAGE_TARGETS: PopupPageTargetValue[] = ["AllPages", "Homepage", "Products", "Recipes", "Blog"];
const AUDIENCE_TARGETS: PopupAudienceTargetValue[] = ["AllVisitors", "NewVisitors", "ReturningVisitors", "Authenticated", "CustomerGroupTarget", "LoyaltyMembers", "ReferralMembers"];
const TRIGGER_TYPES: PopupTriggerTypeValue[] = ["Immediate", "TimeDelay", "ScrollDepth", "ExitIntent", "PageViews", "AddToCart", "BeforeCheckout"];
const FREQUENCY_CAPS: PopupFrequencyCapValue[] = ["OncePerSession", "OncePerDay", "OncePerWeek", "OncePerCustomer", "UntilDismissed"];
const CUSTOMER_GROUPS: CustomerGroupValue[] = ["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"];

const EMPTY_VALUES: PopupFormInput = {
  name: "",
  title: "",
  description: null,
  imageUrl: null,
  imageAlt: null,
  mobileImageUrl: null,
  mobileImageAlt: null,
  videoUrl: null,
  ctaLabel: null,
  ctaHref: null,
  secondaryCtaLabel: null,
  secondaryCtaHref: null,
  couponCode: null,
  pageTarget: "AllPages",
  audienceTarget: "AllVisitors",
  targetCustomerGroup: null,
  triggerType: "Immediate",
  triggerValue: null,
  frequencyCap: "OncePerSession",
  startAt: null,
  endAt: null,
  variantGroupId: null,
  variantWeight: 100,
};

const STATUS_VARIANT: Record<PopupStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "outline",
  Scheduled: "secondary",
  Published: "default",
  Paused: "secondary",
  Unpublished: "destructive",
  Archived: "destructive",
};

function toDateInputValue(value: string | null): string {
  return value ? value.slice(0, 10) : "";
}

export function AdminPopupEditorView({ popupId }: { popupId: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [picker, setPicker] = useState<"image" | "mobileImage" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");

  const { data: existing } = useQuery({
    queryKey: ["admin-popup", popupId],
    queryFn: () => fetchPopup(popupId!),
    enabled: Boolean(popupId),
    refetchOnWindowFocus: false,
  });
  const { data: performance } = useQuery({
    queryKey: ["admin-popup-performance", popupId],
    queryFn: () => fetchPopupPerformance(popupId!),
    enabled: Boolean(popupId),
  });

  const { register, handleSubmit, reset, watch, setValue } = useForm<PopupFormInput>({ defaultValues: EMPTY_VALUES });

  const seeded = useRef(false);
  useEffect(() => {
    if (!existing || seeded.current) return;
    seeded.current = true;
    reset(existing);
  }, [existing, reset]);

  const audienceTarget = watch("audienceTarget");
  const triggerType = watch("triggerType");
  const formValues = watch();

  const onSubmit = handleSubmit(async (values) => {
    setActionError(null);
    setSaved(false);
    try {
      if (popupId) {
        await updatePopupAdmin(popupId, values);
        queryClient.invalidateQueries({ queryKey: ["admin-popup", popupId] });
        setSaved(true);
      } else {
        const created = await createPopupAdmin(values);
        router.push(`/admin/marketing/popups/${created.id}`);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the popup.");
    }
  });

  async function runStatusChange(status: PopupStatusValue) {
    if (!popupId) return;
    setActionError(null);
    try {
      await changePopupStatusAdmin(popupId, status);
      queryClient.invalidateQueries({ queryKey: ["admin-popup", popupId] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to change status.");
    }
  }

  return (
    <div>
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">{popupId ? "Edit Pop-up" : "New Pop-up"}</h1>
          {existing && (
            <div className="mt-1">
              <Badge variant={STATUS_VARIANT[existing.status]}>{existing.status}</Badge>
            </div>
          )}
        </div>
        <Button type="button" variant="outline" onClick={() => setPreviewOpen(true)}>
          Preview
        </Button>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}
      {saved && <p className="mt-3 text-small text-charcoal/70">Saved.</p>}

      {popupId && existing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {existing.status === "Draft" && (
            <Button type="button" size="sm" variant="outline" onClick={() => runStatusChange("Scheduled")}>
              Mark as Scheduled
            </Button>
          )}
          {(existing.status === "Draft" || existing.status === "Scheduled" || existing.status === "Paused") && (
            <Button type="button" size="sm" onClick={() => runStatusChange("Published")}>
              Publish
            </Button>
          )}
          {existing.status === "Published" && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => runStatusChange("Paused")}>
                Pause
              </Button>
              <Button type="button" size="sm" variant="destructive" onClick={() => runStatusChange("Unpublished")}>
                Unpublish
              </Button>
            </>
          )}
          {existing.status !== "Archived" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => runStatusChange("Archived")}>
              Archive
            </Button>
          )}
        </div>
      )}

      {performance && (
        <div className="mt-4 flex gap-6 text-small text-charcoal/70">
          <span>Impressions: {performance.impressions}</span>
          <span>Clicks: {performance.clicks}</span>
          <span>Dismissals: {performance.dismissals}</span>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 grid max-w-2xl gap-4">
        <div>
          <Label htmlFor="popup-name">Internal name</Label>
          <Input id="popup-name" {...register("name")} />
        </div>

        <h2 className="mt-4 text-h4 font-heading text-charcoal">Content</h2>
        <div>
          <Label htmlFor="popup-title">Title</Label>
          <Input id="popup-title" {...register("title")} />
        </div>
        <div>
          <Label htmlFor="popup-description">Description</Label>
          <Textarea id="popup-description" rows={3} {...register("description")} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker("image")}>
            {formValues.imageUrl ? "Change image" : "Choose image"}
          </Button>
          {formValues.imageUrl && <span className="text-small text-charcoal/60">{formValues.imageAlt}</span>}
        </div>
        <div className="flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" onClick={() => setPicker("mobileImage")}>
            {formValues.mobileImageUrl ? "Change mobile image" : "Choose mobile image (optional)"}
          </Button>
          {formValues.mobileImageUrl && <span className="text-small text-charcoal/60">{formValues.mobileImageAlt}</span>}
        </div>
        <div>
          <Label htmlFor="popup-video">Video URL (optional, overrides images)</Label>
          <Input id="popup-video" {...register("videoUrl")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="popup-cta-label">CTA label</Label>
            <Input id="popup-cta-label" {...register("ctaLabel")} />
          </div>
          <div>
            <Label htmlFor="popup-cta-href">CTA link</Label>
            <Input id="popup-cta-href" {...register("ctaHref")} />
          </div>
          <div>
            <Label htmlFor="popup-secondary-cta-label">Secondary CTA label</Label>
            <Input id="popup-secondary-cta-label" {...register("secondaryCtaLabel")} />
          </div>
          <div>
            <Label htmlFor="popup-secondary-cta-href">Secondary CTA link</Label>
            <Input id="popup-secondary-cta-href" {...register("secondaryCtaHref")} />
          </div>
        </div>
        <div>
          <Label htmlFor="popup-coupon">Coupon code (display only)</Label>
          <Input id="popup-coupon" {...register("couponCode")} />
        </div>

        <h2 className="mt-4 text-h4 font-heading text-charcoal">Targeting</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="popup-page-target">Page</Label>
            <Select value={formValues.pageTarget} onValueChange={(value) => setValue("pageTarget", value as PopupPageTargetValue)}>
              <SelectTrigger id="popup-page-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_TARGETS.map((target) => (
                  <SelectItem key={target} value={target}>
                    {target}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="popup-audience-target">Audience</Label>
            <Select value={audienceTarget} onValueChange={(value) => setValue("audienceTarget", value as PopupAudienceTargetValue)}>
              <SelectTrigger id="popup-audience-target">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCE_TARGETS.map((target) => (
                  <SelectItem key={target} value={target}>
                    {target}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {(audienceTarget === "NewVisitors" || audienceTarget === "ReturningVisitors") && (
              <p className="mt-1 text-small text-charcoal/60">Best-effort only — no visitor-session tracking exists yet.</p>
            )}
          </div>
        </div>
        {audienceTarget === "CustomerGroupTarget" && (
          <div>
            <Label htmlFor="popup-customer-group">Customer group</Label>
            <Select value={formValues.targetCustomerGroup ?? undefined} onValueChange={(value) => setValue("targetCustomerGroup", value as CustomerGroupValue)}>
              <SelectTrigger id="popup-customer-group">
                <SelectValue placeholder="Select a group" />
              </SelectTrigger>
              <SelectContent>
                {CUSTOMER_GROUPS.map((group) => (
                  <SelectItem key={group} value={group}>
                    {group}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <h2 className="mt-4 text-h4 font-heading text-charcoal">Trigger & frequency</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="popup-trigger-type">Trigger</Label>
            <Select value={triggerType} onValueChange={(value) => setValue("triggerType", value as PopupTriggerTypeValue)}>
              <SelectTrigger id="popup-trigger-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(triggerType === "TimeDelay" || triggerType === "ScrollDepth" || triggerType === "PageViews") && (
            <div>
              <Label htmlFor="popup-trigger-value">{triggerType === "TimeDelay" ? "Seconds" : triggerType === "ScrollDepth" ? "Scroll %" : "Page views"}</Label>
              <Input id="popup-trigger-value" type="number" min={0} {...register("triggerValue", { valueAsNumber: true })} />
            </div>
          )}
        </div>
        <div>
          <Label htmlFor="popup-frequency-cap">Frequency cap</Label>
          <Select value={formValues.frequencyCap} onValueChange={(value) => setValue("frequencyCap", value as PopupFrequencyCapValue)}>
            <SelectTrigger id="popup-frequency-cap">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_CAPS.map((cap) => (
                <SelectItem key={cap} value={cap}>
                  {cap}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {formValues.frequencyCap === "OncePerSession" && <p className="mt-1 text-small text-charcoal/60">Enforced client-side for guests; server-side for signed-in customers.</p>}
        </div>

        <h2 className="mt-4 text-h4 font-heading text-charcoal">Schedule</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="popup-start">Start date (optional)</Label>
            <Input id="popup-start" type="date" value={toDateInputValue(formValues.startAt)} onChange={(event) => setValue("startAt", event.target.value || null)} />
          </div>
          <div>
            <Label htmlFor="popup-end">End date (optional)</Label>
            <Input id="popup-end" type="date" value={toDateInputValue(formValues.endAt)} onChange={(event) => setValue("endAt", event.target.value || null)} />
          </div>
        </div>

        <h2 className="mt-4 text-h4 font-heading text-charcoal">A/B variant (optional)</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="popup-variant-group">Variant group ID</Label>
            <Input id="popup-variant-group" {...register("variantGroupId")} placeholder="Shared across alternates" />
          </div>
          <div>
            <Label htmlFor="popup-variant-weight">Traffic weight</Label>
            <Input id="popup-variant-weight" type="number" min={1} {...register("variantWeight", { valueAsNumber: true })} />
          </div>
        </div>

        <Button type="submit" className="mt-4 w-fit">
          {popupId ? "Save" : "Create"}
        </Button>
      </form>

      <AssetPickerDialog
        open={picker !== null}
        onOpenChange={(open) => !open && setPicker(null)}
        onSelect={(asset) => {
          if (picker === "image") {
            setValue("imageUrl", asset.url);
            setValue("imageAlt", asset.altText ?? "");
          } else if (picker === "mobileImage") {
            setValue("mobileImageUrl", asset.url);
            setValue("mobileImageAlt", asset.altText ?? "");
          }
          setPicker(null);
        }}
      />

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-2xl">
          <h2 className="text-h4 font-heading text-charcoal">Preview</h2>
          <div className="mt-2 flex gap-2">
            {(["desktop", "tablet", "mobile"] as const).map((viewport) => (
              <Button key={viewport} type="button" size="sm" variant={previewViewport === viewport ? "default" : "outline"} onClick={() => setPreviewViewport(viewport)}>
                {viewport}
              </Button>
            ))}
          </div>
          <div className="relative mt-4 h-[500px] overflow-hidden rounded border border-input bg-cream">
            <PopupOverlay popup={formValues} open forceViewport={previewViewport} onOpenChange={() => {}} />
          </div>
          <p className="mt-2 text-small text-charcoal/60">Preview only — never recorded as an impression or subject to frequency caps.</p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
