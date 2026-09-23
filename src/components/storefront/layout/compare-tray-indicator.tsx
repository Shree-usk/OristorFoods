"use client";

import { useState } from "react";
import Link from "next/link";
import { Scale, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useCompareStore } from "@/lib/stores/compare-store";
import type { ProductListItem } from "@/types/product";

async function fetchTrayItems(ids: string[]): Promise<ProductListItem[]> {
  if (ids.length === 0) return [];
  const response = await fetch(`/api/products/by-ids?ids=${ids.join(",")}`);
  if (!response.ok) throw new Error("Failed to load compare tray items");
  const body: { items: ProductListItem[] } = await response.json();
  return body.items;
}

export function CompareTrayIndicator() {
  const items = useCompareStore((state) => state.items);
  const remove = useCompareStore((state) => state.remove);
  // Controlled so the Compare link can close the menu: the header stays
  // mounted across client-side navigation, so an open menu would otherwise
  // leave its inert overlay blocking the compare page.
  const [isOpen, setIsOpen] = useState(false);

  const { data: trayItems = [] } = useQuery({
    queryKey: ["compare-tray", items],
    queryFn: () => fetchTrayItems(items),
  });

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger
        aria-label={items.length > 0 ? `Compare, ${items.length} item${items.length === 1 ? "" : "s"}` : "Compare"}
        className="relative inline-flex size-9 items-center justify-center rounded-lg hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        <Scale className="size-5" aria-hidden="true" />
        {items.length > 0 && (
          <Badge className="absolute top-0.5 right-0.5 h-4 min-w-4 justify-center rounded-full px-1 text-[10px] leading-none">
            {items.length}
          </Badge>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        {trayItems.length === 0 ? (
          <p className="p-4 text-center text-caption text-charcoal/70">Add products to compare</p>
        ) : (
          <div className="p-2">
            <ul>
              {trayItems.map((item) => (
                <li key={item.id} className="flex items-center gap-2 p-2">
                  <span className="flex-1 truncate text-small">{item.name}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove ${item.name}`}
                    onClick={() => remove(item.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
            <Button
              className="mt-2 w-full"
              nativeButton={false}
              render={<Link href={`/products/compare?ids=${items.join(",")}`} />}
              onClick={() => setIsOpen(false)}
            >
              Compare
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
