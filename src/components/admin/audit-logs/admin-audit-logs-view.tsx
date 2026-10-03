"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { auditLogExportUrl, fetchAuditLogs, type AuditLogFilters } from "@/lib/api/admin-audit-logs-client";
import { ADMIN_MODULES, type AdminModuleValue } from "@/lib/api/admin-roles-client";

/** STORY-057. Filter bar mirrors the established orders/ERP-integration shape (type/status/date-range/search), + a CSV export link (Content-Disposition: attachment, so a plain <a> triggers a real download using the browser's own session cookie). */
export function AdminAuditLogsView() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1 });

  const { data } = useQuery({ queryKey: ["admin-audit-logs", filters], queryFn: () => fetchAuditLogs(filters) });

  function setFilter<K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Audit Log</h1>
        <Button nativeButton={false} variant="outline" render={<a href={auditLogExportUrl(filters)} />}>
          Export CSV
        </Button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="audit-filter-actor">Actor ID</Label>
          <Input id="audit-filter-actor" className="w-48" value={filters.actorId ?? ""} onChange={(event) => setFilter("actorId", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="audit-filter-module">Module</Label>
          <Select value={filters.module ?? "all"} onValueChange={(value) => setFilter("module", value === "all" ? undefined : (value as AdminModuleValue))}>
            <SelectTrigger id="audit-filter-module" className="w-48">
              <SelectValue>{(selected: string | null) => (selected && selected !== "all" ? selected : "All modules")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All modules</SelectItem>
              {ADMIN_MODULES.map((module) => (
                <SelectItem key={module} value={module}>
                  {module}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="audit-filter-action">Action</Label>
          <Input id="audit-filter-action" className="w-48" placeholder="e.g. admin_user_invited" value={filters.action ?? ""} onChange={(event) => setFilter("action", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="audit-filter-from">From</Label>
          <Input id="audit-filter-from" type="date" className="w-36" value={filters.dateFrom ?? ""} onChange={(event) => setFilter("dateFrom", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="audit-filter-to">To</Label>
          <Input id="audit-filter-to" type="date" className="w-36" value={filters.dateTo ?? ""} onChange={(event) => setFilter("dateTo", event.target.value || undefined)} />
        </div>
        <div>
          <Label htmlFor="audit-filter-target">Target ID</Label>
          <Input id="audit-filter-target" className="w-48" value={filters.targetId ?? ""} onChange={(event) => setFilter("targetId", event.target.value || undefined)} />
        </div>
      </div>

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Actor</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Module</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data?.rows ?? []).map((entry) => (
            <TableRow key={entry.id}>
              <TableCell>{new Date(entry.createdAt).toLocaleString()}</TableCell>
              <TableCell>{entry.actor?.email ?? "(system)"}</TableCell>
              <TableCell>{entry.action}</TableCell>
              <TableCell>{entry.module ?? "—"}</TableCell>
              <TableCell>{entry.targetType ? `${entry.targetType} ${entry.targetId}` : "—"}</TableCell>
              <TableCell className="max-w-xs truncate">{entry.metadata ? JSON.stringify(entry.metadata) : "—"}</TableCell>
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
