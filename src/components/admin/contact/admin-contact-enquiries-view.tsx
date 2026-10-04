"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  fetchContactEnquiries,
  updateContactEnquiryStatus,
  type ContactEnquiryStatusValue,
  type ContactEnquiryTypeValue,
} from "@/lib/api/contact-enquiry-client";

const STATUS_OPTIONS: { value: ContactEnquiryStatusValue | "All"; label: string }[] = [
  { value: "All", label: "All statuses" },
  { value: "New", label: "New" },
  { value: "InProgress", label: "In Progress" },
  { value: "Responded", label: "Responded" },
  { value: "Closed", label: "Closed" },
  { value: "Spam", label: "Spam" },
];

const TYPE_OPTIONS: { value: ContactEnquiryTypeValue | "All"; label: string }[] = [
  { value: "All", label: "All types" },
  { value: "General", label: "General" },
  { value: "Product", label: "Product" },
  { value: "CustomerSupport", label: "Customer Support" },
  { value: "Wholesale", label: "Wholesale" },
  { value: "Distributor", label: "Distributor / Dealer" },
  { value: "RetailPartnership", label: "Retail Partnership" },
  { value: "FoodService", label: "Food Service" },
  { value: "Media", label: "Media" },
  { value: "Careers", label: "Careers" },
  { value: "Other", label: "Other" },
];

/** STORY-072. Export-type enquiries never appear here — they route into the existing /admin/export console (STORY-058) instead, see the type options above (no "Export" value). */
export function AdminContactEnquiriesView() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<ContactEnquiryStatusValue | "All">("All");
  const [typeFilter, setTypeFilter] = useState<ContactEnquiryTypeValue | "All">("All");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["admin-contact-enquiries", statusFilter, typeFilter, search],
    queryFn: () =>
      fetchContactEnquiries({
        status: statusFilter === "All" ? undefined : statusFilter,
        enquiryType: typeFilter === "All" ? undefined : typeFilter,
        search: search || undefined,
      }),
  });

  const selected = data?.rows.find((row) => row.id === selectedId) ?? null;

  async function handleStatusChange(id: string, status: ContactEnquiryStatusValue) {
    setActionError(null);
    try {
      await updateContactEnquiryStatus(id, status);
      queryClient.invalidateQueries({ queryKey: ["admin-contact-enquiries"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update status.");
    }
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Contact Enquiries</h1>
      <p className="mt-1 text-small text-charcoal/70">
        Every Contact Us submission except Export/International Business, which lands in the Export Enquiries console instead.
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input placeholder="Search name, email, company…" value={search} onChange={(event) => setSearch(event.target.value)} className="w-64" />
        <Select value={statusFilter} onValueChange={(value) => setStatusFilter((value as ContactEnquiryStatusValue | "All") ?? "All")}>
          <SelectTrigger className="w-40">
            <SelectValue>{(selectedValue: string | null) => STATUS_OPTIONS.find((option) => option.value === selectedValue)?.label ?? "All statuses"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(value) => setTypeFilter((value as ContactEnquiryTypeValue | "All") ?? "All")}>
          <SelectTrigger className="w-48">
            <SelectValue>{(selectedValue: string | null) => TYPE_OPTIONS.find((option) => option.value === selectedValue)?.label ?? "All types"}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Submitted</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.rows ?? []).map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-medium">{row.contactName}</TableCell>
              <TableCell>{row.contactEmail}</TableCell>
              <TableCell>{TYPE_OPTIONS.find((option) => option.value === row.enquiryType)?.label ?? row.enquiryType}</TableCell>
              <TableCell>{STATUS_OPTIONS.find((option) => option.value === row.status)?.label ?? row.status}</TableCell>
              <TableCell>{new Date(row.createdAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedId(row.id)}>
                  View
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {(data?.rows ?? []).length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-small text-charcoal/70">
                No contact enquiries yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelectedId(null)}>
        <DialogContent>
          {selected && (
            <div>
              <h2 className="text-h4 font-heading text-charcoal">{selected.contactName}</h2>
              <dl className="mt-3 space-y-1 text-small">
                <div>
                  <dt className="inline font-medium text-charcoal">Email: </dt>
                  <dd className="inline text-charcoal/80">{selected.contactEmail}</dd>
                </div>
                {selected.contactPhone && (
                  <div>
                    <dt className="inline font-medium text-charcoal">Phone: </dt>
                    <dd className="inline text-charcoal/80">{selected.contactPhone}</dd>
                  </div>
                )}
                {selected.companyName && (
                  <div>
                    <dt className="inline font-medium text-charcoal">Company: </dt>
                    <dd className="inline text-charcoal/80">{selected.companyName}</dd>
                  </div>
                )}
                {selected.country && (
                  <div>
                    <dt className="inline font-medium text-charcoal">Country: </dt>
                    <dd className="inline text-charcoal/80">{selected.country}</dd>
                  </div>
                )}
                <div>
                  <dt className="inline font-medium text-charcoal">Type: </dt>
                  <dd className="inline text-charcoal/80">{TYPE_OPTIONS.find((option) => option.value === selected.enquiryType)?.label ?? selected.enquiryType}</dd>
                </div>
              </dl>
              <p className="mt-3 whitespace-pre-wrap text-small text-charcoal/80">{selected.message}</p>

              <div className="mt-4">
                <label htmlFor="enquiry-status" className="text-small font-medium text-charcoal">
                  Status
                </label>
                <Select value={selected.status} onValueChange={(value) => handleStatusChange(selected.id, value as ContactEnquiryStatusValue)}>
                  <SelectTrigger id="enquiry-status" className="mt-1 w-48">
                    <SelectValue>{(selectedValue: string | null) => STATUS_OPTIONS.find((option) => option.value === selectedValue)?.label ?? selected.status}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.filter((option) => option.value !== "All").map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
