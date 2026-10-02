"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  approveFraudFlagAdmin,
  fetchFraudFlags,
  reverseFraudFlagAdmin,
  type FraudFlag,
  type FraudFlagStatusValue,
} from "@/lib/api/rewards-referrals-admin-client";

const STATUSES: FraudFlagStatusValue[] = ["Pending", "Approved", "Reversed"];

const STATUS_VARIANT: Record<FraudFlagStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Pending: "secondary",
  Approved: "outline",
  Reversed: "destructive",
};

export function AdminFraudQueuePanel() {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<FraudFlagStatusValue>("Pending");
  const [actionError, setActionError] = useState<string | null>(null);
  const [reverseTarget, setReverseTarget] = useState<FraudFlag | null>(null);
  const [reverseNote, setReverseNote] = useState("");

  const { data, isLoading } = useQuery({ queryKey: ["admin-fraud-flags", status], queryFn: () => fetchFraudFlags(status) });
  const flags = data?.flags ?? [];

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-fraud-flags"] });
  }

  async function approve(id: string) {
    setActionError(null);
    try {
      await approveFraudFlagAdmin(id);
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to approve the flag.");
    }
  }

  return (
    <div className="mt-4">
      <p className="text-small text-charcoal/70">
        Shared referrer/referred address, referral velocity, and redemption velocity — rule-based heuristics, never blocking the customer action that triggered them. &ldquo;Shared payment method&rdquo; isn&apos;t checked: the payment
        gateway is still a mock provider with no real card data (blueprint Section 10).
      </p>

      <Select value={status} onValueChange={(value) => setStatus(value as FraudFlagStatusValue)}>
        <SelectTrigger className="mt-3 w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {STATUSES.map((value) => (
            <SelectItem key={value} value={value}>
              {value}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <Table className="mt-3">
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Flagged</TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-charcoal/70">
                Loading…
              </TableCell>
            </TableRow>
          ) : flags.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-charcoal/70">
                No flags.
              </TableCell>
            </TableRow>
          ) : (
            flags.map((flag) => (
              <TableRow key={flag.id}>
                <TableCell>
                  {flag.customer.name ?? "—"}
                  <div className="text-small text-charcoal/60">{flag.customer.email}</div>
                </TableCell>
                <TableCell>{flag.type}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[flag.status]}>{flag.status}</Badge>
                </TableCell>
                <TableCell>{new Date(flag.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  {flag.status === "Pending" && (
                    <div className="flex gap-1">
                      <Button type="button" size="sm" variant="ghost" onClick={() => approve(flag.id)}>
                        Approve
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReverseTarget(flag);
                          setReverseNote("");
                        }}
                      >
                        Reverse
                      </Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>

      <Dialog open={reverseTarget !== null} onOpenChange={(open) => !open && setReverseTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Reverse flagged reward</h2>
          <p className="mt-1 text-small text-charcoal/70">Claws back the associated reward points, if any.</p>
          <Textarea className="mt-3" value={reverseNote} onChange={(event) => setReverseNote(event.target.value)} placeholder="Why this reward is being reversed" rows={3} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={!reverseNote.trim()}
              onClick={async () => {
                if (!reverseTarget) return;
                setActionError(null);
                try {
                  await reverseFraudFlagAdmin(reverseTarget.id, reverseNote);
                  setReverseTarget(null);
                  refresh();
                } catch (error) {
                  setActionError(error instanceof Error ? error.message : "Failed to reverse the flag.");
                }
              }}
            >
              Reverse
            </Button>
            <Button type="button" variant="outline" onClick={() => setReverseTarget(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
