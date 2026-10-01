"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  bulkChangeOrderStatusAdmin,
  fetchOrdersAdmin,
  type OrderStatusValue,
  type PaymentStatusValue,
} from "@/lib/api/admin-orders-client";

const PAGE_SIZE = 20;
const STATUSES: OrderStatusValue[] = ["PendingConfirmation", "Confirmed", "Processing", "Dispatched", "Delivered", "Cancelled", "Returned"];
const PAYMENT_STATUSES: PaymentStatusValue[] = ["Pending", "Succeeded", "Failed", "Refunded"];

const STATUS_VARIANT: Record<OrderStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  PendingConfirmation: "secondary",
  Confirmed: "secondary",
  Processing: "secondary",
  Dispatched: "outline",
  Delivered: "default",
  Cancelled: "destructive",
  Returned: "destructive",
};

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-LK", { style: "currency", currency: "LKR" }).format(amount);
}

export function AdminOrdersListView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<OrderStatusValue | "all">("all");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusValue | "all">("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);

  const filters = {
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    paymentStatus: paymentStatus === "all" ? undefined : paymentStatus,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-orders", filters],
    queryFn: () => fetchOrdersAdmin(filters),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function runBulkStatus(to: OrderStatusValue) {
    setActionError(null);
    try {
      await bulkChangeOrderStatusAdmin(Array.from(selected), to);
      setSelected(new Set());
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bulk status update failed.");
    }
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Orders</h1>
      <p className="mt-1 text-small text-charcoal/70">Track, fulfil, refund, and return customer orders.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search order #, customer name, or email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-72"
        />
        <Label htmlFor="order-status-filter" className="sr-only">
          Status
        </Label>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus((value ?? "all") as OrderStatusValue | "all");
            setPage(1);
          }}
        >
          <SelectTrigger id="order-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor="payment-status-filter" className="sr-only">
          Payment status
        </Label>
        <Select
          value={paymentStatus}
          onValueChange={(value) => {
            setPaymentStatus((value ?? "all") as PaymentStatusValue | "all");
            setPage(1);
          }}
        >
          <SelectTrigger id="payment-status-filter">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All payment statuses</SelectItem>
            {PAYMENT_STATUSES.map((value) => (
              <SelectItem key={value} value={value}>
                {value}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Label htmlFor="order-date-from" className="sr-only">
          From date
        </Label>
        <Input
          id="order-date-from"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          className="w-36"
        />
        <Label htmlFor="order-date-to" className="sr-only">
          To date
        </Label>
        <Input
          id="order-date-to"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          className="w-36"
        />
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-small text-charcoal/70">{selected.size} selected</span>
            <Select onValueChange={(value) => runBulkStatus(value as OrderStatusValue)}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Set status to…" />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>
      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Order #</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Items</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Placed</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-charcoal/70">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelected(item.id)} aria-label={`Select order ${item.orderNumber}`} />
                  </TableCell>
                  <TableCell>
                    <Link href={`/admin/orders/${item.id}`} className="font-medium text-charcoal hover:underline">
                      {item.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <div>{item.customerName}</div>
                    {item.customerEmail && <div className="text-small text-charcoal/60">{item.customerEmail}</div>}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status]}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{item.paymentStatus ?? "—"}</TableCell>
                  <TableCell>{item.itemCount}</TableCell>
                  <TableCell>{formatCurrency(item.grandTotal)}</TableCell>
                  <TableCell>{new Date(item.placedAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>{page}</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
