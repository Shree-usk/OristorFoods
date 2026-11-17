"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminExportPageHeroPanel } from "@/components/admin/export/admin-export-page-hero-panel";
import { AdminExportSolutionCardsEditor } from "@/components/admin/export/admin-export-solution-cards-editor";
import { AdminExportProcessStepsEditor } from "@/components/admin/export/admin-export-process-steps-editor";

/** /export page revamp. The certification strip isn't edited here — see the note below for where it actually lives, so this page doesn't duplicate that settings screen. */
export function AdminExportPageContentView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Export Page Content</h1>
      <p className="mt-2 max-w-2xl text-small text-charcoal/70">
        Controls the hero, Export Solutions cards, and Export Process timeline on the public{" "}
        <Link href="/export" className="underline hover:text-chilli">
          /export
        </Link>{" "}
        page.
      </p>

      <div className="mt-4 flex flex-col gap-2 rounded-md border border-border bg-muted/40 p-4 text-small text-charcoal/80 sm:flex-row sm:items-center sm:justify-between">
        <p>The certification strip shows every certification that has a logo image — add or edit those from Certifications.</p>
        <Button variant="outline" size="sm" nativeButton={false} render={<Link href="/admin/certifications" />}>
          Open Certifications
        </Button>
      </div>

      <Tabs defaultValue="hero" className="mt-6">
        <TabsList>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="solutions">Export Solutions</TabsTrigger>
          <TabsTrigger value="process">Export Process</TabsTrigger>
        </TabsList>
        <TabsContent value="hero" className="mt-4">
          <AdminExportPageHeroPanel />
        </TabsContent>
        <TabsContent value="solutions" className="mt-4">
          <AdminExportSolutionCardsEditor />
        </TabsContent>
        <TabsContent value="process" className="mt-4">
          <AdminExportProcessStepsEditor />
        </TabsContent>
      </Tabs>
    </div>
  );
}
