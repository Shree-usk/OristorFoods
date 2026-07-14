"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { LogOut, Package, User as UserIcon } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initialsFromName(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1
      ? `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase()
      : parts[0]!.slice(0, 2).toUpperCase();
  }
  return email ? email.slice(0, 2).toUpperCase() : "?";
}

export function AccountMenu() {
  const { data: session, status } = useSession();

  if (status !== "authenticated") {
    return (
      <Link
        href="/account/login"
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <UserIcon className="size-5" aria-hidden="true" />
        Sign In
      </Link>
    );
  }

  const user = session.user;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="inline-flex size-9 items-center justify-center rounded-full hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        aria-label="Account menu"
      >
        <Avatar className="size-8">
          <AvatarFallback>{initialsFromName(user?.name, user?.email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{user?.name ?? user?.email ?? "My Account"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/account/orders" />}>
          <Package /> Orders
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/account" />}>
          <UserIcon /> Profile
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOut /> Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
