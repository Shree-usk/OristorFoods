"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fetchDistributorAccounts } from "@/lib/api/admin-export-client";

/** STORY-058. */
export function AdminDistributorAccountsView() {
  const { data: accounts } = useQuery({ queryKey: ["admin-distributor-accounts"], queryFn: fetchDistributorAccounts });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Distributor Accounts</h1>
        <Button type="button" variant="outline" nativeButton={false} render={<Link href="/admin/export" />}>
          Back to Enquiries
        </Button>
      </div>

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Company</TableHead>
            <TableHead>Region</TableHead>
            <TableHead>Contact</TableHead>
            <TableHead>Account</TableHead>
            <TableHead>Converted from</TableHead>
            <TableHead>Created by</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(accounts ?? []).map((account) => (
            <TableRow key={account.id}>
              <TableCell>{account.companyName}</TableCell>
              <TableCell>{account.region}</TableCell>
              <TableCell>{account.contactName} · {account.contactEmail}</TableCell>
              <TableCell>{account.user.email} ({account.user.customerGroup})</TableCell>
              <TableCell>{account.convertedFromEnquiry.companyName}</TableCell>
              <TableCell>{account.createdBy.name}</TableCell>
              <TableCell>{new Date(account.createdAt).toLocaleDateString()}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
