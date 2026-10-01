"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Star } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  approveModerationItem,
  archiveModerationItem,
  bulkModerateItems,
  fetchModerationQueue,
  hideModerationItem,
  publishModerationItem,
  rejectModerationItem,
  replyToModerationItem,
  restoreModerationItem,
  rewardModerationCustomer,
  setModerationItemFeatured,
  type ModerationQueueItem,
  type ModerationSourceType,
} from "@/lib/api/admin-review-moderation-client";

const PAGE_SIZE = 20;

const SOURCE_TYPE_OPTIONS: { value: ModerationSourceType | "all"; label: string }[] = [
  { value: "all", label: "All sources" },
  { value: "product", label: "Product reviews" },
  { value: "recipe", label: "Recipe reviews" },
  { value: "blog-comment", label: "Blog comments" },
];

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Pending: "secondary",
  Approved: "secondary",
  Published: "default",
  Rejected: "destructive",
  Archived: "outline",
  Hidden: "outline",
};

/** Which actions are valid for a given (sourceType, status) — mirrors each domain's own canTransition* table rather than pretending the three lifecycles are symmetric (see review-moderation.service.ts's header comment). */
function nextActions(item: ModerationQueueItem): { label: string; action: "approve" | "reject" | "publish" | "hide" | "archive" | "restore" }[] {
  if (item.sourceType === "product") {
    switch (item.status) {
      case "Pending":
        return [{ label: "Approve", action: "approve" }, { label: "Reject", action: "reject" }];
      case "Approved":
        return [{ label: "Publish", action: "publish" }, { label: "Reject", action: "reject" }];
      case "Published":
        return [{ label: "Archive", action: "archive" }, { label: "Hide", action: "hide" }];
      case "Archived":
      case "Hidden":
        return [{ label: "Restore", action: "restore" }];
      default:
        return [];
    }
  }
  // recipe / blog-comment: Pending -> Approved -> Hidden, Approved IS visible, Hidden is terminal.
  switch (item.status) {
    case "Pending":
      return [{ label: "Approve", action: "approve" }, { label: "Reject", action: "reject" }];
    case "Approved":
      return [{ label: "Hide", action: "hide" }];
    default:
      return [];
  }
}

export function AdminReviewsQueueView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [sourceType, setSourceType] = useState<ModerationSourceType | "all">("all");
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [replyTarget, setReplyTarget] = useState<ModerationQueueItem | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [rewardTarget, setRewardTarget] = useState<ModerationQueueItem | null>(null);
  const [rewardPoints, setRewardPoints] = useState("100");
  const [rewardNote, setRewardNote] = useState("");

  const filters = { page, pageSize: PAGE_SIZE, sourceType: sourceType === "all" ? undefined : sourceType, status: status === "all" ? undefined : status, search: search || undefined };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reviews-queue", filters],
    queryFn: () => fetchModerationQueue(filters),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function itemKey(item: { sourceType: ModerationSourceType; id: string }) {
    return `${item.sourceType}:${item.id}`;
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-reviews-queue"] });
  }

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function runBulk(action: "approve" | "reject") {
    setActionError(null);
    const parsedItems = Array.from(selected).map((key) => {
      const [type, id] = key.split(":");
      return { sourceType: type as ModerationSourceType, id };
    });
    try {
      await bulkModerateItems(parsedItems, action);
      setSelected(new Set());
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bulk action failed.");
    }
  }

  function toggleSelected(item: ModerationQueueItem) {
    const key = itemKey(item);
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function runStatusAction(item: ModerationQueueItem, action: "approve" | "reject" | "publish" | "hide" | "archive" | "restore") {
    const fn = {
      approve: () => approveModerationItem(item.sourceType, item.id),
      reject: () => rejectModerationItem(item.sourceType, item.id),
      publish: () => publishModerationItem(item.id),
      hide: () => hideModerationItem(item.sourceType, item.id),
      archive: () => archiveModerationItem(item.id),
      restore: () => restoreModerationItem(item.id),
    }[action];
    runAction(fn);
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Reviews</h1>
      <p className="mt-1 text-small text-charcoal/70">Moderate product reviews, recipe reviews, and blog comments from one queue.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search body text"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Select
          value={sourceType}
          onValueChange={(value) => {
            setSourceType((value ?? "all") as ModerationSourceType | "all");
            setStatus("all");
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            {SOURCE_TYPE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus(value ?? "all");
            setPage(1);
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            {(sourceType === "product" || sourceType === "all") && <SelectItem value="Published">Published</SelectItem>}
            <SelectItem value="Rejected">Rejected</SelectItem>
            <SelectItem value="Hidden">Hidden</SelectItem>
            {(sourceType === "product" || sourceType === "all") && <SelectItem value="Archived">Archived</SelectItem>}
          </SelectContent>
        </Select>
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-small text-charcoal/70">{selected.size} selected</span>
            <Button type="button" size="sm" variant="outline" onClick={() => runBulk("approve")}>
              Approve selected
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runBulk("reject")}>
              Reject selected
            </Button>
          </div>
        )}
      </div>
      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <div className="mt-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Submitter</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead>Body</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-charcoal/70">
                  No items found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={itemKey(item)}>
                  <TableCell>
                    <Checkbox checked={selected.has(itemKey(item))} onCheckedChange={() => toggleSelected(item)} aria-label={`Select item from ${item.submitterName}`} />
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{item.sourceType === "product" ? "Product" : item.sourceType === "recipe" ? "Recipe" : "Blog comment"}</Badge>
                    {item.featured && (
                      <Badge variant="default" className="ml-1">
                        Featured
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>{item.submitterName}</TableCell>
                  <TableCell>
                    <Link href={item.targetHref} className="text-charcoal hover:underline" target="_blank">
                      {item.targetName}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {item.rating !== null ? (
                      <span className="flex items-center gap-1">
                        <Star className="size-3.5 fill-gold text-gold" /> {item.rating}
                      </span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{item.body}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANT[item.status] ?? "outline"}>{item.status}</Badge>
                  </TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {nextActions(item).map(({ label, action }) => (
                        <Button key={action} type="button" size="sm" variant="ghost" onClick={() => runStatusAction(item, action)}>
                          {label}
                        </Button>
                      ))}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setReplyTarget(item);
                          setReplyBody(item.adminReplyBody ?? "");
                        }}
                      >
                        Reply
                      </Button>
                      {item.sourceType !== "blog-comment" && (
                        <Button type="button" size="sm" variant="ghost" onClick={() => runAction(() => setModerationItemFeatured(item.sourceType, item.id, !item.featured))}>
                          {item.featured ? "Unfeature" : "Feature"}
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setRewardTarget(item);
                          setRewardPoints("100");
                          setRewardNote("");
                        }}
                      >
                        Reward
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <Pagination className="mt-4">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1} />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink isActive>{page}</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <Dialog open={replyTarget !== null} onOpenChange={(open) => !open && setReplyTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Reply</h2>
          <p className="mt-1 text-small text-charcoal/70">A reply from the Oristor team, saved against this item.</p>
          <Textarea className="mt-3" value={replyBody} onChange={(event) => setReplyBody(event.target.value)} placeholder="Write a reply…" rows={4} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!replyBody.trim()}
              onClick={() => {
                if (!replyTarget) return;
                runAction(() => replyToModerationItem(replyTarget.sourceType, replyTarget.id, replyBody));
                setReplyTarget(null);
              }}
            >
              Save reply
            </Button>
            <Button type="button" variant="outline" onClick={() => setReplyTarget(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rewardTarget !== null} onOpenChange={(open) => !open && setRewardTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Reward customer</h2>
          <p className="mt-1 text-small text-charcoal/70">Grants reward points directly to this customer&rsquo;s wallet. A guest commenter with no account can&rsquo;t be rewarded.</p>
          <Label htmlFor="reward-points" className="mt-3 block">
            Points
          </Label>
          <Input id="reward-points" type="number" min={1} value={rewardPoints} onChange={(event) => setRewardPoints(event.target.value)} />
          <Label htmlFor="reward-note" className="mt-3 block">
            Note
          </Label>
          <Textarea id="reward-note" value={rewardNote} onChange={(event) => setRewardNote(event.target.value)} placeholder="Why this grant was made" rows={2} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!rewardNote.trim() || Number(rewardPoints) <= 0}
              onClick={() => {
                if (!rewardTarget) return;
                runAction(() => rewardModerationCustomer(rewardTarget.sourceType, rewardTarget.id, Number(rewardPoints), rewardNote));
                setRewardTarget(null);
              }}
            >
              Grant
            </Button>
            <Button type="button" variant="outline" onClick={() => setRewardTarget(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
