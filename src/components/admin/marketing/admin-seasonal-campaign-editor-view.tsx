"use client";

import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchCampaigns } from "@/lib/api/campaign-admin-client";
import { fetchCoupons } from "@/lib/api/coupon-admin-client";
import { fetchHomepageLayout, fetchHomepageLayouts, type HomepageSection } from "@/lib/api/admin-homepage-builder-client";
import { fetchPopups } from "@/lib/api/popup-admin-client";
import {
  changeSeasonalCampaignStatusAdmin,
  createSeasonalCampaignAdmin,
  fetchSeasonalCampaign,
  fetchSeasonalCampaignPerformance,
  updateSeasonalCampaignAdmin,
  type SeasonalCampaignFormInput,
  type SeasonalCampaignStatusValue,
} from "@/lib/api/seasonal-campaign-admin-client";

const EMPTY_VALUES: SeasonalCampaignFormInput = {
  name: "",
  startDate: "",
  endDate: "",
  popupId: null,
  couponId: null,
  emailSmsCampaignId: null,
  homepageSectionId: null,
};

const STATUS_VARIANT: Record<SeasonalCampaignStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "outline",
  Scheduled: "secondary",
  Active: "default",
  Ended: "secondary",
  Archived: "destructive",
};

const NONE = "__none__";

function toDateInputValue(value: string): string {
  return value ? value.slice(0, 10) : "";
}

/** No single admin endpoint lists the current layout's sections (STORY-042's `findPublishedLayout` is storefront-only) — this is a deliberate two-round-trip client-side read rather than adding an endpoint to that already-shipped module for one dropdown. */
async function fetchPublishedHomepageSections(): Promise<HomepageSection[]> {
  const layouts = await fetchHomepageLayouts("Published");
  const published = layouts[0];
  if (!published) return [];
  const layout = await fetchHomepageLayout(published.id);
  return layout.sections;
}

export function AdminSeasonalCampaignEditorView({ campaignId }: { campaignId: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: existing } = useQuery({
    queryKey: ["admin-seasonal-campaign", campaignId],
    queryFn: () => fetchSeasonalCampaign(campaignId!),
    enabled: Boolean(campaignId),
    refetchOnWindowFocus: false,
  });
  const { data: performance } = useQuery({
    queryKey: ["admin-seasonal-campaign-performance", campaignId],
    queryFn: () => fetchSeasonalCampaignPerformance(campaignId!),
    enabled: Boolean(campaignId),
  });

  const { data: popupsData } = useQuery({ queryKey: ["admin-popups-picker"], queryFn: fetchPopups });
  const { data: couponsData } = useQuery({ queryKey: ["admin-coupons-picker"], queryFn: fetchCoupons });
  const { data: emailSmsData } = useQuery({ queryKey: ["admin-email-sms-picker"], queryFn: fetchCampaigns });
  const { data: sections } = useQuery({ queryKey: ["admin-published-homepage-sections-picker"], queryFn: fetchPublishedHomepageSections });

  const { register, handleSubmit, reset, watch, setValue } = useForm<SeasonalCampaignFormInput>({ defaultValues: EMPTY_VALUES });

  const seeded = useRef(false);
  useEffect(() => {
    if (!existing || seeded.current) return;
    seeded.current = true;
    reset(existing);
  }, [existing, reset]);

  const formValues = watch();

  const onSubmit = handleSubmit(async (values) => {
    setActionError(null);
    setSaved(false);
    try {
      if (campaignId) {
        await updateSeasonalCampaignAdmin(campaignId, values);
        queryClient.invalidateQueries({ queryKey: ["admin-seasonal-campaign", campaignId] });
        setSaved(true);
      } else {
        const created = await createSeasonalCampaignAdmin(values);
        router.push(`/admin/marketing/seasonal-campaigns/${created.id}`);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the seasonal campaign.");
    }
  });

  async function runStatusChange(status: SeasonalCampaignStatusValue) {
    if (!campaignId) return;
    setActionError(null);
    try {
      await changeSeasonalCampaignStatusAdmin(campaignId, status);
      queryClient.invalidateQueries({ queryKey: ["admin-seasonal-campaign", campaignId] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to change status.");
    }
  }

  return (
    <div>
      <div>
        <h1 className="text-h2 font-heading text-charcoal">{campaignId ? "Edit Seasonal Campaign" : "New Seasonal Campaign"}</h1>
        {existing && (
          <div className="mt-1">
            <Badge variant={STATUS_VARIANT[existing.status]}>{existing.status}</Badge>
          </div>
        )}
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}
      {saved && <p className="mt-3 text-small text-charcoal/70">Saved.</p>}

      {campaignId && existing && (
        <div className="mt-4 flex flex-wrap gap-2">
          {existing.status === "Draft" && (
            <Button type="button" size="sm" variant="outline" onClick={() => runStatusChange("Scheduled")}>
              Mark as Scheduled
            </Button>
          )}
          {existing.status === "Scheduled" && (
            <>
              <Button type="button" size="sm" variant="outline" onClick={() => runStatusChange("Draft")}>
                Back to Draft
              </Button>
              <Button type="button" size="sm" onClick={() => runStatusChange("Active")}>
                Activate
              </Button>
            </>
          )}
          {existing.status === "Active" && (
            <Button type="button" size="sm" variant="destructive" onClick={() => runStatusChange("Ended")}>
              End campaign
            </Button>
          )}
          {existing.status !== "Archived" && (
            <Button type="button" size="sm" variant="ghost" onClick={() => runStatusChange("Archived")}>
              Archive
            </Button>
          )}
        </div>
      )}

      {performance && (
        <div className="mt-4 grid gap-3 text-small text-charcoal/70 sm:grid-cols-3">
          {performance.popup && (
            <div>
              <p className="font-medium text-charcoal">Popup</p>
              <p>Impressions: {performance.popup.impressions}</p>
              <p>Clicks: {performance.popup.clicks}</p>
              <p>Dismissals: {performance.popup.dismissals}</p>
            </div>
          )}
          {performance.coupon && (
            <div>
              <p className="font-medium text-charcoal">Coupon</p>
              <p>Redemptions: {performance.coupon.redemptions}</p>
            </div>
          )}
          {performance.emailSmsCampaign && (
            <div>
              <p className="font-medium text-charcoal">Email/SMS/WhatsApp</p>
              <p>Sent: {performance.emailSmsCampaign.sent}</p>
              <p>Failed: {performance.emailSmsCampaign.failed}</p>
              <p>Skipped (no consent): {performance.emailSmsCampaign.skippedNoConsent}</p>
            </div>
          )}
          {!performance.popup && !performance.coupon && !performance.emailSmsCampaign && <p>No linked items to report on yet.</p>}
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 grid max-w-2xl gap-4">
        <div>
          <Label htmlFor="campaign-name">Name</Label>
          <Input id="campaign-name" {...register("name")} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="campaign-start">Start date</Label>
            <Input id="campaign-start" type="date" value={toDateInputValue(formValues.startDate)} onChange={(event) => setValue("startDate", event.target.value)} />
          </div>
          <div>
            <Label htmlFor="campaign-end">End date</Label>
            <Input id="campaign-end" type="date" value={toDateInputValue(formValues.endDate)} onChange={(event) => setValue("endDate", event.target.value)} />
          </div>
        </div>

        <h2 className="mt-4 text-h4 font-heading text-charcoal">Linked items</h2>
        <p className="text-small text-charcoal/60">Link already-created items from their own consoles — this hub only groups them, it does not create or publish them.</p>

        <div>
          <Label htmlFor="campaign-popup">Popup</Label>
          <Select value={formValues.popupId ?? NONE} onValueChange={(value) => setValue("popupId", value === NONE ? null : value)}>
            <SelectTrigger id="campaign-popup">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {popupsData?.popups.map((popup) => (
                <SelectItem key={popup.id} value={popup.id}>
                  {popup.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="campaign-coupon">Coupon</Label>
          <Select value={formValues.couponId ?? NONE} onValueChange={(value) => setValue("couponId", value === NONE ? null : value)}>
            <SelectTrigger id="campaign-coupon">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {couponsData?.coupons.map((coupon) => (
                <SelectItem key={coupon.id} value={coupon.id}>
                  {coupon.code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="campaign-email-sms">Email/SMS/WhatsApp campaign</Label>
          <Select value={formValues.emailSmsCampaignId ?? NONE} onValueChange={(value) => setValue("emailSmsCampaignId", value === NONE ? null : value)}>
            <SelectTrigger id="campaign-email-sms">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {emailSmsData?.campaigns.map((campaign) => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="campaign-homepage-section">Homepage section</Label>
          <Select value={formValues.homepageSectionId ?? NONE} onValueChange={(value) => setValue("homepageSectionId", value === NONE ? null : value)}>
            <SelectTrigger id="campaign-homepage-section">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {sections?.map((section) => (
                <SelectItem key={section.id} value={section.id}>
                  {section.type}
                  {section.titleOverride ? ` — ${section.titleOverride}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {sections?.length === 0 && <p className="mt-1 text-small text-charcoal/60">No Published homepage layout exists yet.</p>}
        </div>

        <Button type="submit" className="mt-4 w-fit">
          {campaignId ? "Save" : "Create"}
        </Button>
      </form>
    </div>
  );
}
