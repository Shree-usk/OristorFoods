"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { checkMenuLinks, fetchMenus, publishMenu, rollbackMenu, type LinkCheckResult, type MenuItem, type MenuLocationValue } from "@/lib/api/admin-navigation-client";
import { MenuItemDrawer } from "./menu-item-drawer";
import { MegaMenuPreview, MenuPreviewPane } from "./menu-preview-pane";
import { MenuTreeEditor } from "./menu-tree-editor";

/**
 * STORY-052. Four tabs matching the AC's "four distinct menu locations"
 * framing — Mega Menu isn't its own backend location (it's nested
 * MenuItem children under a Header item, see navigation.service.ts's
 * own comment), so its tab is a different scoped view over the SAME
 * Header menu rather than a 4th MenuLocationPanel.
 */
export function AdminNavigationView() {
  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Navigation &amp; Menus</h1>
      <Tabs defaultValue="Header" className="mt-6">
        <TabsList>
          <TabsTrigger value="Header">Header</TabsTrigger>
          <TabsTrigger value="MegaMenu">Mega Menu</TabsTrigger>
          <TabsTrigger value="Footer">Footer</TabsTrigger>
          <TabsTrigger value="Mobile">Mobile</TabsTrigger>
        </TabsList>
        <TabsContent value="Header">
          <MenuLocationPanel location="Header" maxDepthOverride={0} />
        </TabsContent>
        <TabsContent value="MegaMenu">
          <MegaMenuTab />
        </TabsContent>
        <TabsContent value="Footer">
          <MenuLocationPanel location="Footer" />
        </TabsContent>
        <TabsContent value="Mobile">
          <MenuLocationPanel location="Mobile" />
        </TabsContent>
      </Tabs>
    </div>
  );
}

type DrawerTarget = MenuItem | { parentId: string | null } | null;

function MenuLocationPanel({ location, maxDepthOverride }: { location: MenuLocationValue; maxDepthOverride?: number }) {
  const queryClient = useQueryClient();
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [linkResults, setLinkResults] = useState<LinkCheckResult[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const queryKey = ["admin-navigation", location];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchMenus(location) });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  async function handlePublish() {
    setActionError(null);
    try {
      await publishMenu(location);
      setAnnouncement(`${location} menu published.`);
      invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to publish.");
    }
  }

  async function handleRollback() {
    setActionError(null);
    try {
      await rollbackMenu(location);
      setAnnouncement(`${location} menu rolled back.`);
      invalidate();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to roll back.");
    }
  }

  async function handleCheckLinks() {
    if (!data?.draft) return;
    setActionError(null);
    setLinkResults(null);
    try {
      const results = await checkMenuLinks(data.draft.id);
      setLinkResults(results);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to check links.");
    }
  }

  if (isLoading || !data) return <p className="mt-4 text-small text-muted-foreground">Loading…</p>;

  return (
    <div className="mt-4 grid gap-6 lg:grid-cols-2">
      <div aria-live="polite" className="sr-only">
        {announcement}
      </div>
      <div role="region" aria-label="Menu editor">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-small text-muted-foreground">
            Draft status: {data.draft.status}
            {data.published && " • a published version is live"}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleCheckLinks}>
              Check links
            </Button>
            <Button size="sm" variant="outline" onClick={handleRollback}>
              Roll back
            </Button>
            <Button size="sm" onClick={handlePublish}>
              Publish
            </Button>
          </div>
        </div>
        {actionError && <p className="mb-2 text-small text-destructive">{actionError}</p>}
        {linkResults && (
          <ul className="mb-4 space-y-1 text-small">
            {linkResults.map((result) => (
              <li key={result.itemId} className={result.ok ? "text-muted-foreground" : "text-destructive"}>
                {result.ok ? "✓" : "✗"} {result.label}
                {result.reason ? ` — ${result.reason}` : ""}
              </li>
            ))}
          </ul>
        )}
        <MenuTreeEditor
          location={location}
          items={data.draft.items}
          maxDepthOverride={maxDepthOverride}
          onChanged={invalidate}
          onAddItem={(parentId) => {
            setDrawerTarget({ parentId });
            setDrawerOpen(true);
          }}
          onEditItem={(item) => {
            setDrawerTarget(item);
            setDrawerOpen(true);
          }}
        />
      </div>
      <MenuPreviewPane location={location} items={data.draft.items} />

      <MenuItemDrawer location={location} open={drawerOpen} onOpenChange={setDrawerOpen} target={drawerTarget} allowPromoTile={false} onChanged={invalidate} />
    </div>
  );
}

/**
 * Edits one Header top-level item's nested tree (mega-menu sections + their
 * links/promo tiles) — depth 1-2 of the SAME Header Menu the Header tab
 * manages at depth 0, not a separate location. Publish/rollback live on
 * the Header tab, since they're one Menu record.
 */
function MegaMenuTab() {
  const queryClient = useQueryClient();
  const queryKey = ["admin-navigation", "Header"];
  const { data, isLoading } = useQuery({ queryKey, queryFn: () => fetchMenus("Header") });
  const [selectedTopId, setSelectedTopId] = useState<string | null>(null);
  const [drawerTarget, setDrawerTarget] = useState<DrawerTarget>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey });
  }

  if (isLoading || !data) return <p className="mt-4 text-small text-muted-foreground">Loading…</p>;

  const topItems = data.draft.items.filter((item) => item.parentId === null);
  const activeTopId = selectedTopId ?? topItems[0]?.id ?? null;
  const allowPromoTile = drawerTarget !== null && "parentId" in drawerTarget && drawerTarget.parentId !== null && drawerTarget.parentId !== activeTopId;

  return (
    <div className="mt-4">
      <p className="mb-3 text-small text-muted-foreground">Editing the Header menu&apos;s draft — publish from the Header tab to make mega-menu changes live.</p>
      <Select value={activeTopId ?? ""} onValueChange={setSelectedTopId}>
        <SelectTrigger className="w-64">
          <SelectValue placeholder="Choose a Header item" />
        </SelectTrigger>
        <SelectContent>
          {topItems.map((item) => (
            <SelectItem key={item.id} value={item.id}>
              {item.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {activeTopId && (
        <div className="mt-4 grid gap-6 lg:grid-cols-2">
          <div role="region" aria-label="Menu editor">
            <MenuTreeEditor
              location="Header"
              items={data.draft.items}
              rootParentId={activeTopId}
              rootDepth={1}
              onChanged={invalidate}
              onAddItem={(parentId) => {
                setDrawerTarget({ parentId });
                setDrawerOpen(true);
              }}
              onEditItem={(item) => {
                setDrawerTarget(item);
                setDrawerOpen(true);
              }}
            />
          </div>
          <MegaMenuPreview items={data.draft.items} topItemId={activeTopId} />
        </div>
      )}

      <MenuItemDrawer location="Header" open={drawerOpen} onOpenChange={setDrawerOpen} target={drawerTarget} allowPromoTile={allowPromoTile} onChanged={invalidate} />
    </div>
  );
}
