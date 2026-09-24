"use client";

import { Printer } from "lucide-react";
import { ShareButtons } from "@/components/storefront/product/share-buttons";
import { Button } from "@/components/ui/button";

interface RecipePrintShareBarProps {
  url: string;
  title: string;
}

export function RecipePrintShareBar({ url, title }: RecipePrintShareBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer />
        Print
      </Button>
      <ShareButtons url={url} title={title} />
    </div>
  );
}
