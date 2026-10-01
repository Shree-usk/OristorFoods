"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchCustomersAdmin, type AccountStatusValue } from "@/lib/api/admin-customers-client";

const PAGE_SIZE = 20;
const STATUSES: AccountStatusValue[] = ["Active", "DeactivationRequested", "Deactivated", "Suspended"];

const STATUS_VARIANT: Record<AccountStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Active: "default",
  DeactivationRequested: "secondary",
  Deactivated: "outline",
  Suspended: "destructive",
};

export function AdminCustomersListView() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<AccountStatusValue | "all">("all");
  const [search, setSearch] = useState("");

  const filters = { page, pageSize: PAGE_SIZE, status: status === "all" ? undefined : status, search: search || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-customers", filters],
    queryFn: () => fetchCustomersAdmin(filters),
  });

  const customers = data?.customers ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Customers</h1>
      <p className="mt-1 text-small text-charcoal/70">Profiles, purchase/support/login history, suspensions, and manual rewards/coupons.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search name or email"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-72"
        />
        <Label htmlFor="customer-status-filter" className="sr-only">
          Status
        </Label>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus((value ?? "all") as AccountStatusValue | "all");
            setPage(1);
          }}
        >
          <SelectTrigger id="customer-status-filter">
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
      </div>

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Group</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-charcoal/70">
                  No customers found.
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer) => (
                <TableRow key={customer.id}>
                  <TableCell>
                    <Link href={`/admin/customers/${customer.id}`} className="font-medium text-charcoal hover:underline">
                      {customer.name ?? "—"}
                    </Link>
                  </TableCell>
                  <TableCell>{customer.email ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[customer.status]}>{customer.status}</Badge>
                  </TableCell>
                  <TableCell>{customer.customerGroup}</TableCell>
                  <TableCell>{new Date(customer.createdAt).toLocaleDateString()}</TableCell>
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
