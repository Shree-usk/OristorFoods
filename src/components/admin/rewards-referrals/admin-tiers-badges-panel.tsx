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
import {
  createBadgeAdmin,
  createTierAdmin,
  fetchBadges,
  fetchTiers,
  updateBadgeAdmin,
  updateTierAdmin,
} from "@/lib/api/rewards-referrals-admin-client";

const CRITERIA_TYPES = ["first_order", "order_count", "lifetime_points"] as const;

export function AdminTiersBadgesPanel() {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [tierName, setTierName] = useState("");
  const [tierThreshold, setTierThreshold] = useState("0");

  const [badgeDialogOpen, setBadgeDialogOpen] = useState(false);
  const [badgeCode, setBadgeCode] = useState("");
  const [badgeName, setBadgeName] = useState("");
  const [badgeCriteria, setBadgeCriteria] = useState<(typeof CRITERIA_TYPES)[number]>("first_order");
  const [badgeThreshold, setBadgeThreshold] = useState("");

  const { data: tiersData } = useQuery({ queryKey: ["admin-reward-tiers"], queryFn: fetchTiers });
  const { data: badgesData } = useQuery({ queryKey: ["admin-badges"], queryFn: fetchBadges });
  const tiers = tiersData?.tiers ?? [];
  const badges = badgesData?.badges ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-reward-tiers"] });
    queryClient.invalidateQueries({ queryKey: ["admin-badges"] });
  }

  async function toggleTierActive(id: string, isActive: boolean) {
    setActionError(null);
    try {
      await updateTierAdmin(id, { isActive: !isActive });
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update the tier.");
    }
  }

  async function toggleBadgeActive(id: string, isActive: boolean) {
    setActionError(null);
    try {
      await updateBadgeAdmin(id, { isActive: !isActive });
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update the badge.");
    }
  }

  return (
    <div className="mt-4">
      {actionError && <p className="mb-2 text-small text-destructive">{actionError}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-h4 font-heading text-charcoal">Loyalty tiers</h3>
        <Button type="button" size="sm" onClick={() => setTierDialogOpen(true)}>
          New tier
        </Button>
      </div>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Qualifying threshold</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {tiers.map((tier) => (
            <TableRow key={tier.id}>
              <TableCell>{tier.name}</TableCell>
              <TableCell>{tier.minLifetimePoints} lifetime points</TableCell>
              <TableCell>
                <UiBadge variant={tier.isActive ? "default" : "outline"}>{tier.isActive ? "Active" : "Inactive"}</UiBadge>
              </TableCell>
              <TableCell>
                <Button type="button" size="sm" variant="ghost" onClick={() => toggleTierActive(tier.id, tier.isActive)}>
                  {tier.isActive ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="mt-8 flex items-center justify-between">
        <h3 className="text-h4 font-heading text-charcoal">Badges</h3>
        <Button type="button" size="sm" onClick={() => setBadgeDialogOpen(true)}>
          New badge
        </Button>
      </div>
      <Table className="mt-2">
        <TableHeader>
          <TableRow>
            <TableHead>Code</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Criteria</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {badges.map((badge) => (
            <TableRow key={badge.id}>
              <TableCell>{badge.code}</TableCell>
              <TableCell>{badge.name}</TableCell>
              <TableCell>
                {badge.criteriaType}
                {badge.threshold ? ` (${badge.threshold})` : ""}
              </TableCell>
              <TableCell>
                <UiBadge variant={badge.isActive ? "default" : "outline"}>{badge.isActive ? "Active" : "Inactive"}</UiBadge>
              </TableCell>
              <TableCell>
                <Button type="button" size="sm" variant="ghost" onClick={() => toggleBadgeActive(badge.id, badge.isActive)}>
                  {badge.isActive ? "Deactivate" : "Activate"}
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">New tier</h2>
          <Label htmlFor="tier-name" className="mt-3 block">
            Name
          </Label>
          <Input id="tier-name" value={tierName} onChange={(event) => setTierName(event.target.value)} />
          <Label htmlFor="tier-threshold" className="mt-3 block">
            Qualifying lifetime points
          </Label>
          <Input id="tier-threshold" type="number" min={0} value={tierThreshold} onChange={(event) => setTierThreshold(event.target.value)} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!tierName.trim()}
              onClick={async () => {
                setActionError(null);
                try {
                  await createTierAdmin({ name: tierName, minLifetimePoints: Number(tierThreshold), sortOrder: tiers.length, isActive: true });
                  setTierDialogOpen(false);
                  setTierName("");
                  refresh();
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "Failed to create the tier.");
                }
              }}
            >
              Create
            </Button>
            <Button type="button" variant="outline" onClick={() => setTierDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={badgeDialogOpen} onOpenChange={setBadgeDialogOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">New badge</h2>
          <Label htmlFor="badge-code" className="mt-3 block">
            Code
          </Label>
          <Input id="badge-code" value={badgeCode} onChange={(event) => setBadgeCode(event.target.value)} placeholder="loyal_customer" />
          <Label htmlFor="badge-name" className="mt-3 block">
            Name
          </Label>
          <Input id="badge-name" value={badgeName} onChange={(event) => setBadgeName(event.target.value)} />
          <Label htmlFor="badge-criteria" className="mt-3 block">
            Criteria
          </Label>
          <Select value={badgeCriteria} onValueChange={(value) => setBadgeCriteria(value as (typeof CRITERIA_TYPES)[number])}>
            <SelectTrigger id="badge-criteria">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRITERIA_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {badgeCriteria !== "first_order" && (
            <>
              <Label htmlFor="badge-threshold" className="mt-3 block">
                Threshold
              </Label>
              <Input id="badge-threshold" type="number" min={1} value={badgeThreshold} onChange={(event) => setBadgeThreshold(event.target.value)} />
            </>
          )}
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!badgeCode.trim() || !badgeName.trim()}
              onClick={async () => {
                setActionError(null);
                try {
                  await createBadgeAdmin({
                    code: badgeCode,
                    name: badgeName,
                    description: null,
                    criteriaType: badgeCriteria,
                    threshold: badgeCriteria === "first_order" ? null : Number(badgeThreshold),
                    isActive: true,
                  });
                  setBadgeDialogOpen(false);
                  setBadgeCode("");
                  setBadgeName("");
                  refresh();
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "Failed to create the badge.");
                }
              }}
            >
              Create
            </Button>
            <Button type="button" variant="outline" onClick={() => setBadgeDialogOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
