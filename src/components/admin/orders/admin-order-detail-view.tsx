"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  changeOrderStatusAdmin,
  fetchOrderAdminDetail,
  orderInvoiceUrl,
  orderPackingSlipUrl,
  orderShippingLabelUrl,
  processReturnAdmin,
  refundOrderAdmin,
  type ReturnReasonCodeValue,
} from "@/lib/api/admin-orders-client";

const RETURN_REASON_CODES: ReturnReasonCodeValue[] = ["Damaged", "WrongItem", "NotAsDescribed", "ChangedMind", "Other"];

function formatCurrency(amount: number, currency: string) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency }).format(amount);
}

export function AdminOrderDetailView({ orderId }: { orderId: string }) {
  const queryClient = useQueryClient();
  const [actionError, setActionError] = useState<string | null>(null);

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundReason, setRefundReason] = useState("");

  const [returnOpen, setReturnOpen] = useState(false);
  const [returnItems, setReturnItems] = useState<Set<string>>(new Set());
  const [returnReasonCode, setReturnReasonCode] = useState<ReturnReasonCodeValue>("Damaged");
  const [restocked, setRestocked] = useState(true);

  const { data: order, isLoading } = useQuery({
    queryKey: ["admin-order", orderId],
    queryFn: () => fetchOrderAdminDetail(orderId),
  });

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-order", orderId] });
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

  if (isLoading || !order) {
    return <p className="text-charcoal/70">Loading…</p>;
  }

  const remainingRefundable = order.grandTotal - order.refundRecords.reduce((sum, record) => sum + record.amount, 0);
  const alreadyReturned = order.returnRequests.some((request) => request.status === "Requested");

  function toggleReturnItem(orderItemId: string) {
    setReturnItems((current) => {
      const next = new Set(current);
      if (next.has(orderItemId)) next.delete(orderItemId);
      else next.add(orderItemId);
      return next;
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin/orders" className="text-small text-charcoal/60 hover:underline">
            ← All orders
          </Link>
          <h1 className="mt-1 text-h2 font-heading text-charcoal">{order.orderNumber}</h1>
          <p className="mt-1 text-small text-charcoal/70">
            Placed {new Date(order.placedAt).toLocaleString()} by {order.customerName}
            {order.customerEmail ? ` (${order.customerEmail})` : ""}
          </p>
        </div>
        <Badge>{order.status}</Badge>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {order.nextLegalStatuses.map((next) => (
          <Button key={next} type="button" size="sm" variant="outline" onClick={() => runAction(() => changeOrderStatusAdmin(orderId, next))}>
            Mark as {next}
          </Button>
        ))}
        <Button type="button" size="sm" variant="outline" onClick={() => setRefundOpen(true)} disabled={!order.payment || remainingRefundable <= 0}>
          Refund
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setReturnItems(new Set(order.items.map((item) => item.orderItemId)));
            setReturnOpen(true);
          }}
        >
          {alreadyReturned ? "Process return request" : "Record return"}
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={orderInvoiceUrl(orderId)} target="_blank" rel="noopener noreferrer">
          <Button type="button" size="sm" variant="ghost">
            Download invoice
          </Button>
        </a>
        <a href={orderPackingSlipUrl(orderId)} target="_blank" rel="noopener noreferrer">
          <Button type="button" size="sm" variant="ghost">
            Download packing slip
          </Button>
        </a>
        <a href={orderShippingLabelUrl(orderId)} target="_blank" rel="noopener noreferrer">
          <Button type="button" size="sm" variant="ghost">
            Download shipping label
          </Button>
        </a>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h2 className="text-h4 font-heading text-charcoal">Items</h2>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Unit price</TableHead>
                <TableHead>Line total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.items.map((item) => (
                <TableRow key={item.orderItemId}>
                  <TableCell>{item.productName}</TableCell>
                  <TableCell>{item.productSku}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{formatCurrency(item.unitPrice, order.currency)}</TableCell>
                  <TableCell>{formatCurrency(item.lineTotal, order.currency)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="mt-4 ml-auto w-full max-w-xs space-y-1 text-small">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatCurrency(order.subtotal, order.currency)}</span>
            </div>
            <div className="flex justify-between">
              <span>Delivery</span>
              <span>{formatCurrency(order.deliveryCharge, order.currency)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between">
                <span>{order.discountLabel ?? "Discount"}</span>
                <span>-{formatCurrency(order.discount, order.currency)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium">
              <span>Total</span>
              <span>{formatCurrency(order.grandTotal, order.currency)}</span>
            </div>
          </div>

          <h2 className="mt-8 text-h4 font-heading text-charcoal">Status history</h2>
          <ul className="mt-2 space-y-1 text-small text-charcoal/80">
            {order.statusHistory.map((entry, index) => (
              <li key={index}>
                {new Date(entry.createdAt).toLocaleString()} — {entry.status} ({entry.actor})
              </li>
            ))}
          </ul>

          {order.refundRecords.length > 0 && (
            <>
              <h2 className="mt-8 text-h4 font-heading text-charcoal">Refunds</h2>
              <ul className="mt-2 space-y-1 text-small text-charcoal/80">
                {order.refundRecords.map((record) => (
                  <li key={record.id}>
                    {new Date(record.createdAt).toLocaleString()} — {formatCurrency(record.amount, order.currency)} ({record.reason})
                  </li>
                ))}
              </ul>
            </>
          )}

          {order.returnRequests.length > 0 && (
            <>
              <h2 className="mt-8 text-h4 font-heading text-charcoal">Returns</h2>
              <ul className="mt-2 space-y-1 text-small text-charcoal/80">
                {order.returnRequests.map((request) => (
                  <li key={request.id}>
                    {new Date(request.createdAt).toLocaleString()} — {request.status}
                    {request.reasonCode ? ` (${request.reasonCode})` : ""}
                    {request.restocked ? ", restocked" : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <h2 className="text-h4 font-heading text-charcoal">Shipping</h2>
          <div className="mt-2 text-small text-charcoal/80">
            <p>{order.shippingAddress.recipientName}</p>
            <p>{order.shippingAddress.phone}</p>
            <p>{order.shippingAddress.line1}</p>
            {order.shippingAddress.line2 && <p>{order.shippingAddress.line2}</p>}
            <p>
              {order.shippingAddress.city}
              {order.shippingAddress.district ? `, ${order.shippingAddress.district}` : ""}
              {order.shippingAddress.postalCode ? ` ${order.shippingAddress.postalCode}` : ""}
            </p>
          </div>
          <p className="mt-2 text-small text-charcoal/70">
            Zone: {order.deliveryZoneName}
            {order.estimatedDaysMin != null && order.estimatedDaysMax != null ? ` (${order.estimatedDaysMin}–${order.estimatedDaysMax} days)` : ""}
          </p>
          {order.tracking.trackingNumber && (
            <p className="mt-2 text-small text-charcoal/70">
              Tracking: {order.tracking.carrier} {order.tracking.trackingNumber}
            </p>
          )}

          <h2 className="mt-6 text-h4 font-heading text-charcoal">Payment</h2>
          {order.payment ? (
            <p className="mt-2 text-small text-charcoal/80">
              {order.payment.provider} — {order.payment.status} — {formatCurrency(order.payment.amount, order.payment.currency)}
            </p>
          ) : (
            <p className="mt-2 text-small text-charcoal/70">No payment recorded.</p>
          )}
        </div>
      </div>

      <Dialog open={refundOpen} onOpenChange={setRefundOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Refund</h2>
          <p className="mt-1 text-small text-charcoal/70">Remaining refundable balance: {formatCurrency(remainingRefundable, order.currency)}.</p>
          <Label htmlFor="refund-amount" className="mt-3 block">
            Amount
          </Label>
          <Input id="refund-amount" type="number" min={0.01} step={0.01} value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} />
          <Label htmlFor="refund-reason" className="mt-3 block">
            Reason
          </Label>
          <Textarea id="refund-reason" value={refundReason} onChange={(event) => setRefundReason(event.target.value)} rows={3} placeholder="Why this refund is being issued" />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!refundReason.trim() || Number(refundAmount) <= 0}
              onClick={() => {
                runAction(() => refundOrderAdmin(orderId, Number(refundAmount), refundReason));
                setRefundOpen(false);
                setRefundAmount("");
                setRefundReason("");
              }}
            >
              Issue refund
            </Button>
            <Button type="button" variant="outline" onClick={() => setRefundOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Record return</h2>
          <p className="mt-1 text-small text-charcoal/70">Select the returned items, then optionally restock them.</p>
          <div className="mt-3 space-y-2">
            {order.items.map((item) => (
              <div key={item.orderItemId} className="flex items-center gap-2">
                <Checkbox checked={returnItems.has(item.orderItemId)} onCheckedChange={() => toggleReturnItem(item.orderItemId)} aria-label={`Include ${item.productName}`} />
                <span className="text-small">
                  {item.productName} (qty {item.quantity})
                </span>
              </div>
            ))}
          </div>
          <Label htmlFor="return-reason-code" className="mt-3 block">
            Reason
          </Label>
          <Select value={returnReasonCode} onValueChange={(value) => setReturnReasonCode(value as ReturnReasonCodeValue)}>
            <SelectTrigger id="return-reason-code">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RETURN_REASON_CODES.map((code) => (
                <SelectItem key={code} value={code}>
                  {code}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="mt-3 flex items-center gap-2">
            <Checkbox checked={restocked} onCheckedChange={(checked) => setRestocked(checked === true)} id="restock-checkbox" />
            <Label htmlFor="restock-checkbox">Restock these items</Label>
          </div>
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={returnItems.size === 0}
              onClick={() => {
                const selectedItems = order.items.filter((item) => returnItems.has(item.orderItemId)).map((item) => ({ orderItemId: item.orderItemId, productName: item.productName, quantity: item.quantity }));
                runAction(() => processReturnAdmin(orderId, { items: selectedItems, reasonCode: returnReasonCode, restocked }));
                setReturnOpen(false);
              }}
            >
              Save return
            </Button>
            <Button type="button" variant="outline" onClick={() => setReturnOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
