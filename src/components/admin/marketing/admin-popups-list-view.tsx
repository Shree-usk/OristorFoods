"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchPopups, type PopupStatusValue } from "@/lib/api/popup-admin-client";

const STATUS_VARIANT: Record<PopupStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "outline",
  Scheduled: "secondary",
  Published: "default",
  Paused: "secondary",
  Unpublished: "destructive",
  Archived: "destructive",
};

export function AdminPopupsListView() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-popups"], queryFn: fetchPopups });
  const popups = data?.popups ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">Promotional Pop-ups</h1>
          <p className="mt-1 text-small text-charcoal/70">Targeting, triggers, frequency, scheduling, and performance for site-wide pop-up campaigns.</p>
        </div>
        <Link href="/admin/marketing/popups/new">
          <Button type="button">New popup</Button>
        </Link>
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Page</TableHead>
            <TableHead>Audience</TableHead>
            <TableHead>Schedule</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-charcoal/70">
                Loading…
              </TableCell>
            </TableRow>
          ) : popups.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-charcoal/70">
                No popups yet.
              </TableCell>
            </TableRow>
          ) : (
            popups.map((popup) => (
              <TableRow key={popup.id}>
                <TableCell>
                  <Link href={`/admin/marketing/popups/${popup.id}`} className="font-medium text-charcoal hover:underline">
                    {popup.name}
                  </Link>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[popup.status]}>{popup.status}</Badge>
                </TableCell>
                <TableCell>{popup.pageTarget}</TableCell>
                <TableCell>{popup.audienceTarget}</TableCell>
                <TableCell>
                  {popup.startAt ? new Date(popup.startAt).toLocaleDateString() : "—"} – {popup.endAt ? new Date(popup.endAt).toLocaleDateString() : "ongoing"}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
