"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchLandingPages, type LandingPageStatusValue } from "@/lib/api/landing-page-admin-client";

const STATUS_VARIANT: Record<LandingPageStatusValue, "default" | "secondary" | "outline" | "destructive"> = {
  Draft: "outline",
  Published: "default",
  Archived: "destructive",
};

export function AdminLandingPagesListView() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-landing-pages"], queryFn: fetchLandingPages });
  const landingPages = data?.landingPages ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">Landing Pages</h1>
          <p className="mt-1 text-small text-charcoal/70">Simple, slug-addressable pages for campaign-specific traffic.</p>
        </div>
        <Link href="/admin/marketing/landing-pages/new">
          <Button type="button">New landing page</Button>
        </Link>
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Published</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-charcoal/70">
                Loading…
              </TableCell>
            </TableRow>
          ) : landingPages.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-charcoal/70">
                No landing pages yet.
              </TableCell>
            </TableRow>
          ) : (
            landingPages.map((landingPage) => (
              <TableRow key={landingPage.id}>
                <TableCell>
                  <Link href={`/admin/marketing/landing-pages/${landingPage.id}`} className="font-medium text-charcoal hover:underline">
                    {landingPage.name}
                  </Link>
                </TableCell>
                <TableCell>/landing/{landingPage.slug}</TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[landingPage.status]}>{landingPage.status}</Badge>
                </TableCell>
                <TableCell>{landingPage.publishedAt ? new Date(landingPage.publishedAt).toLocaleDateString() : "—"}</TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
