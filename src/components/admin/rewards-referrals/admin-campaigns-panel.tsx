"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createCampaignAdmin,
  fetchCampaigns,
  updateCampaignAdmin,
  type CustomerGroupValue,
} from "@/lib/api/rewards-referrals-admin-client";

const GROUPS: CustomerGroupValue[] = ["Retail", "Wholesale", "Distributor", "Export", "PrivateLabel"];

export function AdminCampaignsPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [targetGroup, setTargetGroup] = useState<CustomerGroupValue | "all">("all");
  const [multiplier, setMultiplier] = useState("2");

  const { data, isLoading } = useQuery({ queryKey: ["admin-reward-campaigns"], queryFn: fetchCampaigns });
  const campaigns = data?.campaigns ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-reward-campaigns"] });
  }

  async function toggleActive(id: string, isActive: boolean) {
    setActionError(null);
    try {
      await updateCampaignAdmin(id, { isActive: !isActive });
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update the campaign.");
    }
  }

  return (
    <div>
      <div className="mt-4 flex items-center justify-between">
        <p className="text-small text-charcoal/70">A time-boxed points multiplier, optionally scoped to one customer group.</p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          New campaign
        </Button>
      </div>
      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <Table className="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Group</TableHead>
            <TableHead>Multiplier</TableHead>
            <TableHead>Dates</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-charcoal/70">
                Loading…
              </TableCell>
            </TableRow>
          ) : campaigns.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-charcoal/70">
                No campaigns yet.
              </TableCell>
            </TableRow>
          ) : (
            campaigns.map((campaign) => (
              <TableRow key={campaign.id}>
                <TableCell>{campaign.name}</TableCell>
                <TableCell>{campaign.targetCustomerGroup ?? "All groups"}</TableCell>
                <TableCell>{campaign.pointsMultiplier}x</TableCell>
                <TableCell>
                  {new Date(campaign.startDate).toLocaleDateString()} – {new Date(campaign.endDate).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  <Badge variant={campaign.isActive ? "default" : "outline"}>{campaign.isActive ? "Active" : "Inactive"}</Badge>
                </TableCell>
                <TableCell>
                  <Button type="button" size="sm" variant="ghost" onClick={() => toggleActive(campaign.id, campaign.isActive)}>
                    {campaign.isActive ? "Deactivate" : "Activate"}
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">New campaign</h2>
          <Label htmlFor="campaign-name" className="mt-3 block">
            Name
          </Label>
          <Input id="campaign-name" value={name} onChange={(event) => setName(event.target.value)} />
          <Label htmlFor="campaign-start" className="mt-3 block">
            Start date
          </Label>
          <Input id="campaign-start" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Label htmlFor="campaign-end" className="mt-3 block">
            End date
          </Label>
          <Input id="campaign-end" type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <Label htmlFor="campaign-group" className="mt-3 block">
            Target group
          </Label>
          <Select value={targetGroup} onValueChange={(value) => setTargetGroup(value as CustomerGroupValue | "all")}>
            <SelectTrigger id="campaign-group">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All groups</SelectItem>
              {GROUPS.map((group) => (
                <SelectItem key={group} value={group}>
                  {group}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Label htmlFor="campaign-multiplier" className="mt-3 block">
            Points multiplier
          </Label>
          <Input id="campaign-multiplier" type="number" min={0.1} step={0.1} value={multiplier} onChange={(event) => setMultiplier(event.target.value)} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!name.trim() || !startDate || !endDate}
              onClick={async () => {
                setActionError(null);
                try {
                  await createCampaignAdmin({
                    name,
                    startDate: new Date(startDate).toISOString(),
                    endDate: new Date(endDate).toISOString(),
                    targetCustomerGroup: targetGroup === "all" ? null : targetGroup,
                    pointsMultiplier: Number(multiplier),
                    isActive: true,
                  });
                  setCreateOpen(false);
                  setName("");
                  setStartDate("");
                  setEndDate("");
                  refresh();
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "Failed to create the campaign.");
                }
              }}
            >
              Create
            </Button>
            <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
