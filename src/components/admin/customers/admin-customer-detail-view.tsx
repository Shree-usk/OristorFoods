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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  addCustomerNoteAdmin,
  fetchCustomerAdminDetail,
  grantRewardAdmin,
  issueCouponAdmin,
  reactivateCustomerAdmin,
  suspendCustomerAdmin,
  type CouponDiscountTypeValue,
} from "@/lib/api/admin-customers-client";

export function AdminCustomerDetailView({ customerId }: { customerId: string }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const [suspendOpen, setSuspendOpen] = useState(false);
  const [suspendReason, setSuspendReason] = useState("");

  const [rewardOpen, setRewardOpen] = useState(false);
  const [rewardPoints, setRewardPoints] = useState("100");
  const [rewardReason, setRewardReason] = useState("");

  const [couponOpen, setCouponOpen] = useState(false);
  const [couponDiscountType, setCouponDiscountType] = useState<CouponDiscountTypeValue>("PercentageOff");
  const [couponValue, setCouponValue] = useState("10");
  const [couponExpiresInDays, setCouponExpiresInDays] = useState("30");
  const [couponUsageLimit, setCouponUsageLimit] = useState("1");
  const [issuedCode, setIssuedCode] = useState<string | null>(null);

  const [noteBody, setNoteBody] = useState("");

  const { data: detail, isLoading } = useQuery({
    queryKey: ["admin-customer", customerId],
    queryFn: () => fetchCustomerAdminDetail(customerId),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-customer", customerId] });
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  if (isLoading || !detail) {
    return <p className="text-charcoal/70">Loading…</p>;
  }

  const { customer } = detail;
  const isSuspended = customer.status === "Suspended";

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">{customer.name ?? customer.email}</h1>
          <p className="mt-1 text-small text-charcoal/70">
            {customer.email} · Registered {new Date(customer.createdAt).toLocaleDateString()}
          </p>
        </div>
        <Badge variant={isSuspended ? "destructive" : "default"}>{customer.status}</Badge>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}
      {isSuspended && customer.suspendedReason && (
        <p className="mt-2 text-small text-charcoal/70">
          Suspended {customer.suspendedAt && new Date(customer.suspendedAt).toLocaleString()} — {customer.suspendedReason}
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {isSuspended ? (
          <Button type="button" size="sm" variant="outline" onClick={() => runAction(() => reactivateCustomerAdmin(customerId))}>
            Reactivate
          </Button>
        ) : (
          <Button type="button" size="sm" variant="outline" onClick={() => setSuspendOpen(true)}>
            Suspend
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" onClick={() => setRewardOpen(true)}>
          Grant reward points
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => setCouponOpen(true)}>
          Issue coupon
        </Button>
      </div>

      <Tabs defaultValue="profile" className="mt-6">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="purchases">Purchase History</TabsTrigger>
          <TabsTrigger value="support">Support History</TabsTrigger>
          <TabsTrigger value="logins">Login History</TabsTrigger>
          <TabsTrigger value="rewards">Rewards & Referrals</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <p className="mt-3 text-small text-charcoal/80">Phone: {customer.phone ?? "—"}</p>
          <h3 className="mt-4 text-small font-medium text-charcoal">Addresses</h3>
          <ul className="mt-1 space-y-1 text-small text-charcoal/80">
            {detail.addresses.length === 0 && <li>No saved addresses.</li>}
            {detail.addresses.map((address) => (
              <li key={address.id}>
                {address.label}: {address.line1}, {address.city}
                {address.isDefaultBilling ? " (default billing)" : ""}
                {address.isDefaultShipping ? " (default shipping)" : ""}
              </li>
            ))}
          </ul>

          <h3 className="mt-6 text-small font-medium text-charcoal">Internal notes</h3>
          <p className="text-small text-charcoal/60">Never visible to the customer.</p>
          <ul className="mt-2 space-y-2 text-small text-charcoal/80">
            {detail.notes.length === 0 && <li>No notes yet.</li>}
            {detail.notes.map((note) => (
              <li key={note.id} className="rounded border border-input p-2">
                <p>{note.body}</p>
                <p className="mt-1 text-charcoal/50">
                  {note.author.name ?? "Admin"} · {new Date(note.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Add a support note…" rows={2} />
            <Button
              type="button"
              size="sm"
              disabled={!noteBody.trim()}
              onClick={() => {
                runAction(() => addCustomerNoteAdmin(customerId, noteBody));
                setNoteBody("");
              }}
            >
              Add
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="purchases">
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Order #</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Placed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.orders.orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-charcoal/70">
                    No orders yet.
                  </TableCell>
                </TableRow>
              ) : (
                detail.orders.orders.map((order) => (
                  <TableRow key={order.orderNumber}>
                    <TableCell>{order.orderNumber}</TableCell>
                    <TableCell>{order.status}</TableCell>
                    <TableCell>
                      {order.currency} {order.grandTotal.toFixed(2)}
                    </TableCell>
                    <TableCell>{new Date(order.placedAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="support">
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Subject</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.tickets.tickets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-charcoal/70">
                    No support tickets.
                  </TableCell>
                </TableRow>
              ) : (
                detail.tickets.tickets.map((ticket) => (
                  <TableRow key={ticket.id}>
                    <TableCell>{ticket.subject}</TableCell>
                    <TableCell>{ticket.category}</TableCell>
                    <TableCell>{ticket.status}</TableCell>
                    <TableCell>{new Date(ticket.createdAt).toLocaleDateString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="logins">
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Result</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>When</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detail.loginHistory.events.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-charcoal/70">
                    No login history yet.
                  </TableCell>
                </TableRow>
              ) : (
                detail.loginHistory.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell>
                      <Badge variant={event.success ? "default" : "destructive"}>{event.success ? "Success" : "Failed"}</Badge>
                    </TableCell>
                    <TableCell>{event.ipAddress ?? "—"}</TableCell>
                    <TableCell className="max-w-xs truncate">{event.userAgent ?? "—"}</TableCell>
                    <TableCell>{new Date(event.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="rewards">
          <div className="mt-3 text-small text-charcoal/80">
            <p>Spendable points: {detail.rewards.spendable}</p>
            <p>Lifetime achievement: {detail.rewards.lifetimeAchievement}</p>
            <p>Current tier: {detail.rewards.currentTier?.name ?? "—"}</p>
            <p className="mt-3">Referral code: {detail.referrals.code}</p>
            <p>Points earned from referrals: {detail.referrals.totalPointsEarned}</p>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Suspend customer</h2>
          <p className="mt-1 text-small text-charcoal/70">Blocks storefront login immediately.</p>
          <Textarea className="mt-3" value={suspendReason} onChange={(event) => setSuspendReason(event.target.value)} placeholder="Reason for suspension" rows={3} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={!suspendReason.trim()}
              onClick={() => {
                runAction(() => suspendCustomerAdmin(customerId, suspendReason));
                setSuspendOpen(false);
                setSuspendReason("");
              }}
            >
              Suspend
            </Button>
            <Button type="button" variant="outline" onClick={() => setSuspendOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rewardOpen} onOpenChange={setRewardOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Grant reward points</h2>
          <Label htmlFor="reward-points" className="mt-3 block">
            Points
          </Label>
          <Input id="reward-points" type="number" min={1} value={rewardPoints} onChange={(event) => setRewardPoints(event.target.value)} />
          <Label htmlFor="reward-reason" className="mt-3 block">
            Reason
          </Label>
          <Textarea id="reward-reason" value={rewardReason} onChange={(event) => setRewardReason(event.target.value)} rows={2} placeholder="Why this grant was made" />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!rewardReason.trim() || Number(rewardPoints) <= 0}
              onClick={() => {
                runAction(() => grantRewardAdmin(customerId, Number(rewardPoints), rewardReason, null));
                setRewardOpen(false);
                setRewardReason("");
              }}
            >
              Grant
            </Button>
            <Button type="button" variant="outline" onClick={() => setRewardOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={couponOpen}
        onOpenChange={(open) => {
          setCouponOpen(open);
          if (!open) setIssuedCode(null);
        }}
      >
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Issue coupon</h2>
          {issuedCode ? (
            <>
              <p className="mt-2 text-small text-charcoal/70">Coupon created — read this code to the customer:</p>
              <p className="mt-1 text-h3 font-heading text-chilli">{issuedCode}</p>
              <Button type="button" className="mt-3" variant="outline" onClick={() => setCouponOpen(false)}>
                Close
              </Button>
            </>
          ) : (
            <>
              <Label htmlFor="coupon-discount-type" className="mt-3 block">
                Discount type
              </Label>
              <Select value={couponDiscountType} onValueChange={(value) => setCouponDiscountType(value as CouponDiscountTypeValue)}>
                <SelectTrigger id="coupon-discount-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PercentageOff">Percentage off</SelectItem>
                  <SelectItem value="FixedAmountOff">Fixed amount off</SelectItem>
                  <SelectItem value="FreeShipping">Free shipping</SelectItem>
                </SelectContent>
              </Select>
              {couponDiscountType !== "FreeShipping" && (
                <>
                  <Label htmlFor="coupon-value" className="mt-3 block">
                    {couponDiscountType === "PercentageOff" ? "Percent off" : "Amount off"}
                  </Label>
                  <Input id="coupon-value" type="number" min={0} value={couponValue} onChange={(event) => setCouponValue(event.target.value)} />
                </>
              )}
              <Label htmlFor="coupon-expires" className="mt-3 block">
                Expires in (days)
              </Label>
              <Input id="coupon-expires" type="number" min={1} value={couponExpiresInDays} onChange={(event) => setCouponExpiresInDays(event.target.value)} />
              <Label htmlFor="coupon-usage-limit" className="mt-3 block">
                Usage limit
              </Label>
              <Input id="coupon-usage-limit" type="number" min={1} value={couponUsageLimit} onChange={(event) => setCouponUsageLimit(event.target.value)} />
              <p className="mt-1 text-small text-charcoal/60">1 = single-use. Always restricted to this customer only.</p>
              <div className="mt-3 flex gap-2">
                <Button
                  type="button"
                  onClick={async () => {
                    setActionError(null);
                    try {
                      const result = await issueCouponAdmin(customerId, {
                        discountType: couponDiscountType,
                        percentOff: couponDiscountType === "PercentageOff" ? Number(couponValue) : undefined,
                        amountOff: couponDiscountType === "FixedAmountOff" ? Number(couponValue) : undefined,
                        expiresInDays: Number(couponExpiresInDays),
                        usageLimit: Number(couponUsageLimit),
                      });
                      setIssuedCode(result.code);
                    } catch (error) {
                      setActionError(error instanceof Error ? error.message : "Failed to issue the coupon.");
                    }
                  }}
                >
                  Issue
                </Button>
                <Button type="button" variant="outline" onClick={() => setCouponOpen(false)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
