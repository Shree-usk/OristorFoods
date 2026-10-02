"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { bulkImportRedirectsAdmin, fetchRedirects, type BulkImportResult } from "@/lib/api/redirect-admin-client";

export function AdminRedirectsListView() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["admin-redirects"], queryFn: fetchRedirects });
  const redirects = data?.redirects ?? [];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<BulkImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setImportError(null);
    setImportResult(null);
    try {
      const csv = await file.text();
      const result = await bulkImportRedirectsAdmin(csv);
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["admin-redirects"] });
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Failed to import the CSV file.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">Redirects</h1>
          <p className="mt-1 text-small text-charcoal/70">301/302 URL redirects, resolved on every storefront request.</p>
        </div>
        <div className="flex gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFileSelected} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            Import CSV
          </Button>
          <Link href="/admin/seo/redirects/new">
            <Button type="button">New redirect</Button>
          </Link>
        </div>
      </div>

      {importError && <p className="mt-3 text-small text-destructive">{importError}</p>}
      {importResult && (
        <div className="mt-3 rounded border border-input p-3 text-small">
          <p className="font-medium text-charcoal">
            Imported {importResult.succeeded.length} redirect{importResult.succeeded.length === 1 ? "" : "s"}
            {importResult.failed.length > 0 ? `, ${importResult.failed.length} failed` : ""}.
          </p>
          {importResult.failed.length > 0 && (
            <ul className="mt-2 space-y-1 text-destructive">
              {importResult.failed.map((row) => (
                <li key={row.line}>
                  Line {row.line} ({row.sourcePath}): {row.error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Destination</TableHead>
            <TableHead>Status code</TableHead>
            <TableHead>Active</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-charcoal/70">
                Loading…
              </TableCell>
            </TableRow>
          ) : redirects.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-charcoal/70">
                No redirects yet.
              </TableCell>
            </TableRow>
          ) : (
            redirects.map((redirect) => (
              <TableRow key={redirect.id}>
                <TableCell>
                  <Link href={`/admin/seo/redirects/${redirect.id}`} className="font-medium text-charcoal hover:underline">
                    {redirect.sourcePath}
                  </Link>
                </TableCell>
                <TableCell>{redirect.destinationPath}</TableCell>
                <TableCell>{redirect.statusCode}</TableCell>
                <TableCell>
                  <Badge variant={redirect.active ? "default" : "secondary"}>{redirect.active ? "Active" : "Inactive"}</Badge>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
