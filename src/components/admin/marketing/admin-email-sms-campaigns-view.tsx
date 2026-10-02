"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge as UiBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createCampaignAdmin,
  fetchCampaignDeliverySummary,
  fetchCampaigns,
  processDueCampaignsAdmin,
  sendCampaignNowAdmin,
  updateCampaignAdmin,
  type Campaign,
  type CampaignAudienceTargetValue,
  type CampaignChannelValue,
  type CampaignFormInput,
} from "@/lib/api/campaign-admin-client";

const CHANNELS: { value: CampaignChannelValue; label: string }[] = [
  { value: "Email", label: "Email" },
  { value: "SMS", label: "SMS" },
  { value: "WhatsApp", label: "WhatsApp" },
];

const AUDIENCE_TARGETS: { value: CampaignAudienceTargetValue; label: string }[] = [
  { value: "AllCustomers", label: "All customers" },
  { value: "CustomerGroupTarget", label: "A specific customer group" },
  { value: "LoyaltyMembers", label: "Loyalty members" },
  { value: "ReferralMembers", label: "Referral members" },
];

const CUSTOMER_GROUPS = ["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"];

function emptyForm(): CampaignFormInput {
  return { name: "", channel: "Email", audienceTarget: "AllCustomers", targetCustomerGroup: null, subject: "", body: "", scheduledAt: null };
}

function toFormInput(campaign: Campaign): CampaignFormInput {
  return {
    name: campaign.name,
    channel: campaign.channel,
    audienceTarget: campaign.audienceTarget,
    targetCustomerGroup: campaign.targetCustomerGroup,
    subject: campaign.subject,
    body: campaign.body,
    scheduledAt: campaign.scheduledAt ? campaign.scheduledAt.slice(0, 16) : null,
  };
}

function DeliverySummary({ campaignId }: { campaignId: string }) {
  const { data } = useQuery({ queryKey: ["admin-campaign-performance", campaignId], queryFn: () => fetchCampaignDeliverySummary(campaignId) });
  if (!data) return null;
  return (
    <span className="text-small text-charcoal/70">
      {data.sent} sent · {data.failed} failed · {data.skippedNoConsent} skipped
    </span>
  );
}

export function AdminEmailSmsCampaignsView() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CampaignFormInput>(emptyForm());

  const { data } = useQuery({ queryKey: ["admin-campaigns"], queryFn: fetchCampaigns });
  const campaigns = data?.campaigns ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-campaigns"] });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setDialogOpen(true);
  }

  function openEdit(campaign: Campaign) {
    setEditingId(campaign.id);
    setForm(toFormInput(campaign));
    setDialogOpen(true);
  }

  async function handleSubmit() {
    setActionError(null);
    try {
      const payload = {
        ...form,
        subject: form.channel === "Email" && form.subject?.trim() ? form.subject : null,
        scheduledAt: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
      };
      if (editingId) {
        await updateCampaignAdmin(editingId, payload);
      } else {
        await createCampaignAdmin(payload);
      }
      setDialogOpen(false);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the campaign.");
    }
  }

  async function handleSendNow(id: string) {
    setActionError(null);
    try {
      await sendCampaignNowAdmin(id);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to send the campaign.");
    }
  }

  async function handleProcessDue() {
    setActionError(null);
    try {
      const result = await processDueCampaignsAdmin();
      refresh();
      setActionError(result.processed === 0 ? "No due campaigns to send." : null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to process due campaigns.");
    }
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Email, SMS & WhatsApp Campaigns</h1>
      <p className="mt-1 text-small text-charcoal/70">Bulk sends to a customer segment — sent now, or scheduled and dispatched via &quot;Send due campaigns&quot;.</p>

      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-h4 font-heading text-charcoal">Campaigns</h3>
        <div className="flex gap-2">
          <Button type="button" size="sm" variant="outline" onClick={handleProcessDue}>
            Send due campaigns
          </Button>
          <Button type="button" size="sm" onClick={openCreate}>
            New campaign
          </Button>
        </div>
      </div>

      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Schedule</TableHead>
            <TableHead>Delivery</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {campaigns.map((campaign) => (
            <TableRow key={campaign.id}>
              <TableCell className="font-medium">{campaign.name}</TableCell>
              <TableCell>{campaign.channel}</TableCell>
              <TableCell>
                {campaign.audienceTarget === "CustomerGroupTarget" ? `${campaign.targetCustomerGroup}` : campaign.audienceTarget}
              </TableCell>
              <TableCell>
                <UiBadge variant={campaign.status === "Sent" ? "default" : "outline"}>{campaign.status}</UiBadge>
              </TableCell>
              <TableCell>{campaign.scheduledAt ? new Date(campaign.scheduledAt).toLocaleString() : "—"}</TableCell>
              <TableCell>{campaign.status === "Sent" ? <DeliverySummary campaignId={campaign.id} /> : "—"}</TableCell>
              <TableCell className="space-x-2">
                {campaign.status !== "Sent" && (
                  <>
                    <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(campaign)}>
                      Edit
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => handleSendNow(campaign.id)}>
                      Send now
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
          {campaigns.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-small text-charcoal/60">
                No campaigns yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <h2 className="text-h4 font-heading text-charcoal">{editingId ? "Edit campaign" : "New campaign"}</h2>

          <Label htmlFor="campaign-name" className="mt-3 block">
            Internal name
          </Label>
          <Input id="campaign-name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="October loyalty blast" />

          <Label htmlFor="campaign-channel" className="mt-3 block">
            Channel
          </Label>
          <Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value as CampaignChannelValue })}>
            <SelectTrigger id="campaign-channel">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((channel) => (
                <SelectItem key={channel.value} value={channel.value}>
                  {channel.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {form.channel === "Email" && (
            <>
              <Label htmlFor="campaign-subject" className="mt-3 block">
                Subject
              </Label>
              <Input id="campaign-subject" value={form.subject ?? ""} onChange={(event) => setForm({ ...form, subject: event.target.value })} />
            </>
          )}

          <Label htmlFor="campaign-body" className="mt-3 block">
            Message ({"{{name}}"} inserts the customer&apos;s name)
          </Label>
          <Textarea id="campaign-body" rows={5} value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} placeholder="Hi {{name}}, enjoy 15% off this week!" />

          <Label htmlFor="campaign-audience" className="mt-3 block">
            Audience
          </Label>
          <Select value={form.audienceTarget} onValueChange={(value) => setForm({ ...form, audienceTarget: value as CampaignAudienceTargetValue })}>
            <SelectTrigger id="campaign-audience">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCE_TARGETS.map((target) => (
                <SelectItem key={target.value} value={target.value}>
                  {target.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {form.audienceTarget === "CustomerGroupTarget" && (
            <>
              <Label htmlFor="campaign-customer-group" className="mt-3 block">
                Customer group
              </Label>
              <Select value={form.targetCustomerGroup ?? ""} onValueChange={(value) => setForm({ ...form, targetCustomerGroup: value })}>
                <SelectTrigger id="campaign-customer-group">
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
            </>
          )}

          <Label htmlFor="campaign-schedule" className="mt-3 block">
            Schedule for later (optional — leave blank to send now)
          </Label>
          <Input id="campaign-schedule" type="datetime-local" value={form.scheduledAt ?? ""} onChange={(event) => setForm({ ...form, scheduledAt: event.target.value || null })} />

          <div className="mt-4 flex gap-2">
            <Button type="button" disabled={!form.name.trim() || !form.body.trim()} onClick={handleSubmit}>
              {editingId ? "Save" : "Create"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
