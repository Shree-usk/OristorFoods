"use client";

import Link from "next/link";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminExportCertificationStripEditor } from "@/components/admin/export/admin-export-certification-strip-editor";
import { AdminExportPageHeroPanel } from "@/components/admin/export/admin-export-page-hero-panel";
import { AdminExportSolutionCardsEditor } from "@/components/admin/export/admin-export-solution-cards-editor";
import { AdminExportProcessStepsEditor } from "@/components/admin/export/admin-export-process-steps-editor";

export function AdminExportPageContentView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Export Page Content</h1>
      <p className="mt-2 max-w-2xl text-small text-charcoal/70">
        Controls the hero, certification strip, Export Solutions cards, and Export Process timeline on the public{" "}
        <Link href="/export" className="underline hover:text-chilli">
          /export
        </Link>{" "}
        page.
      </p>

      <Tabs defaultValue="hero" className="mt-6">
        <TabsList>
          <TabsTrigger value="hero">Hero</TabsTrigger>
          <TabsTrigger value="strip">Certification strip</TabsTrigger>
          <TabsTrigger value="solutions">Export Solutions</TabsTrigger>
          <TabsTrigger value="process">Export Process</TabsTrigger>
        </TabsList>
        <TabsContent value="hero" className="mt-4">
          <AdminExportPageHeroPanel />
        </TabsContent>
        <TabsContent value="strip" className="mt-4">
          <AdminExportCertificationStripEditor />
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
