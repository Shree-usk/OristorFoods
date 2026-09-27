"use client";

import { Download, Printer } from "lucide-react";
import { ShareButtons } from "@/components/storefront/product/share-buttons";
import { Button, buttonVariants } from "@/components/ui/button";

interface RecipePrintShareBarProps {
  url: string;
  title: string;
  recipeSlug: string;
}

export function RecipePrintShareBar({ url, title, recipeSlug }: RecipePrintShareBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 print:hidden">
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <Printer />
        Print
      </Button>
      <a
        href={`/api/recipes/${recipeSlug}/pdf`}
        download
        aria-label={`Download ${title} recipe card as a PDF`}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <Download />
        Download PDF
      </a>
      <ShareButtons url={url} title={title} />
    </div>
  );
}
