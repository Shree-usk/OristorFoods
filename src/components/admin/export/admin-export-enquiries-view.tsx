"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchEnquiries, type ExportEnquiryFilters, type ExportEnquiryStatusValue } from "@/lib/api/admin-export-client";

const STATUS_OPTIONS: ExportEnquiryStatusValue[] = ["New", "InDiscussion", "Quoted", "Won", "Lost"];
const STATUS_LABELS: Record<ExportEnquiryStatusValue, string> = { New: "New", InDiscussion: "In Discussion", Quoted: "Quoted", Won: "Won", Lost: "Lost" };
const STATUS_BADGE_VARIANT: Record<ExportEnquiryStatusValue, "default" | "outline" | "destructive"> = {
  New: "outline",
  InDiscussion: "outline",
  Quoted: "outline",
  Won: "default",
  Lost: "destructive",
};

/** STORY-058. Filter bar + list mirrors admin-audit-logs-view.tsx's established shape. */
export function AdminExportEnquiriesView() {
  const [filters, setFilters] = useState<ExportEnquiryFilters>({ page: 1 });

  const { data } = useQuery({ queryKey: ["admin-export-enquiries", filters], queryFn: () => fetchEnquiries(filters) });

  function setFilter<K extends keyof ExportEnquiryFilters>(key: K, value: ExportEnquiryFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Export Enquiries</h1>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href="/admin/export/distributor-accounts" />}>
          Distributor Accounts
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="export-filter-status">Status</Label>
          <Select value={filters.status ?? "all"} onValueChange={(value) => setFilter("status", value === "all" ? undefined : (value as ExportEnquiryStatusValue))}>
            <SelectTrigger id="export-filter-status" className="w-44">
              <SelectValue>{(selected: string | null) => (selected && selected !== "all" ? STATUS_LABELS[selected as ExportEnquiryStatusValue] : "All statuses")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUS_OPTIONS.map((status) => (
                <SelectItem key={status} value={status}>
                  {STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="export-filter-country">Country</Label>
          <Input id="export-filter-country" className="w-40" value={filters.country ?? ""} onChange={(event) => setFilter("country", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="export-filter-company">Company</Label>
          <Input id="export-filter-company" className="w-48" value={filters.companyName ?? ""} onChange={(event) => setFilter("companyName", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="export-filter-products">Products of interest</Label>
          <Input id="export-filter-products" className="w-48" value={filters.productsOfInterest ?? ""} onChange={(event) => setFilter("productsOfInterest", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="export-filter-from">From</Label>
          <Input id="export-filter-from" type="date" className="w-36" value={filters.dateFrom ?? ""} onChange={(event) => setFilter("dateFrom", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="export-filter-to">To</Label>
          <Input id="export-filter-to" type="date" className="w-36" value={filters.dateTo ?? ""} onChange={(event) => setFilter("dateTo", event.target.value || undefined)} />
        </div>
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Country</TableHead>
            <TableHead>Products</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Assigned to</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.rows ?? []).map((enquiry) => (
            <TableRow key={enquiry.id}>
              <TableCell>{enquiry.companyName}</TableCell>
              <TableCell>{enquiry.contactName}</TableCell>
              <TableCell>{enquiry.country}</TableCell>
              <TableCell className="max-w-xs truncate">{enquiry.productsOfInterest}</TableCell>
              <TableCell>
                <Badge variant={STATUS_BADGE_VARIANT[enquiry.status]}>{STATUS_LABELS[enquiry.status]}</Badge>
              </TableCell>
              <TableCell>{enquiry.assignedTo?.name ?? "Unassigned"}</TableCell>
              <TableCell>{new Date(enquiry.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/admin/export/${enquiry.id}`} />}>
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {data && data.total > data.pageSize && (
        <div className="mt-4 flex items-center gap-3">
          <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) <= 1} onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) - 1 }))}>
            Previous
          </Button>
          <span className="text-small text-charcoal/70">
            Page {data.page} of {totalPages}
          </span>
          <Button type="button" variant="outline" size="sm" disabled={(filters.page ?? 1) >= totalPages} onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page ?? 1) + 1 }))}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
