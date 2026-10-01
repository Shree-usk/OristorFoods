"use client";

import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
  answerRecipeQaItem,
  approveRecipeQaItem,
  bulkModerateRecipeQaItems,
  fetchRecipeQaQueue,
  publishRecipeQaItem,
  rejectRecipeQaItem,
  type RecipeQaQueueItem,
  type RecipeQuestionStatusValue,
} from "@/lib/api/admin-recipe-qa-client";

const PAGE_SIZE = 20;

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  Pending: "secondary",
  Answered: "secondary",
  Approved: "secondary",
  Published: "default",
  Rejected: "destructive",
};

/** Mirrors recipe-qa.service.ts's allowedTransitions table exactly (same shape as admin-qa-queue-view.tsx, STORY-046). */
function nextActions(item: RecipeQaQueueItem): { label: string; action: "answer" | "approve" | "publish" | "reject" }[] {
  switch (item.status) {
    case "Pending":
      return [{ label: "Answer", action: "answer" }, { label: "Reject", action: "reject" }];
    case "Answered":
      return [{ label: "Approve", action: "approve" }, { label: "Reject", action: "reject" }];
    case "Approved":
      return [{ label: "Publish", action: "publish" }, { label: "Reject", action: "reject" }];
    case "Published":
      return [{ label: "Reject", action: "reject" }];
    default:
      return [];
  }
}

export function AdminRecipeQaQueueView() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<RecipeQuestionStatusValue | "all">("Pending");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [answerTarget, setAnswerTarget] = useState<RecipeQaQueueItem | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [rejectTarget, setRejectTarget] = useState<RecipeQaQueueItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const filters = {
    page,
    pageSize: PAGE_SIZE,
    status: status === "all" ? undefined : status,
    search: search || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  };

  const { data, isLoading } = useQuery({
    queryKey: ["admin-recipe-qa-queue", filters],
    queryFn: () => fetchRecipeQaQueue(filters),
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ["admin-recipe-qa-queue"] });
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

  async function runBulk(action: "approve" | "publish") {
    setActionError(null);
    try {
      await bulkModerateRecipeQaItems(Array.from(selected), action);
      setSelected(new Set());
      refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Bulk action failed.");
    }
  }

  function toggleSelected(id: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function runStatusAction(item: RecipeQaQueueItem, action: "answer" | "approve" | "publish" | "reject") {
    if (action === "answer") {
      setAnswerTarget(item);
      setAnswerText(item.answerText ?? "");
      return;
    }
    if (action === "reject") {
      setRejectTarget(item);
      setRejectReason("");
      return;
    }
    const fn = action === "approve" ? () => approveRecipeQaItem(item.id) : () => publishRecipeQaItem(item.id);
    runAction(fn);
  }

  return (
    <div>
      <h1 className="text-h2 font-heading text-charcoal">Recipe Q&amp;A</h1>
      <p className="mt-1 text-small text-charcoal/70">Answer and moderate recipe questions.</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search question, answer, or recipe"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          className="w-64"
        />
        <Label htmlFor="recipe-qa-status-filter" className="sr-only">
          Status
        </Label>
        <Select
          value={status}
          onValueChange={(value) => {
            setStatus((value ?? "all") as RecipeQuestionStatusValue | "all");
            setPage(1);
          }}
        >
          <SelectTrigger id="recipe-qa-status-filter">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Pending">Pending</SelectItem>
            <SelectItem value="Answered">Answered</SelectItem>
            <SelectItem value="Approved">Approved</SelectItem>
            <SelectItem value="Published">Published</SelectItem>
            <SelectItem value="Rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
        <Label htmlFor="recipe-qa-date-from" className="sr-only">
          From date
        </Label>
        <Input
          id="recipe-qa-date-from"
          type="date"
          value={dateFrom}
          onChange={(event) => {
            setDateFrom(event.target.value);
            setPage(1);
          }}
          className="w-36"
        />
        <Label htmlFor="recipe-qa-date-to" className="sr-only">
          To date
        </Label>
        <Input
          id="recipe-qa-date-to"
          type="date"
          value={dateTo}
          onChange={(event) => {
            setDateTo(event.target.value);
            setPage(1);
          }}
          className="w-36"
        />
        {selected.size > 0 && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-small text-charcoal/70">{selected.size} selected</span>
            <Button type="button" size="sm" variant="outline" onClick={() => runBulk("approve")}>
              Approve selected
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => runBulk("publish")}>
              Publish selected
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
              <TableHead>Submitter</TableHead>
              <TableHead>Recipe</TableHead>
              <TableHead>Question</TableHead>
              <TableHead>Answer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-charcoal/70">
                  Loading…
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-charcoal/70">
                  No questions found.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>
                    <Checkbox checked={selected.has(item.id)} onCheckedChange={() => toggleSelected(item.id)} aria-label={`Select question from ${item.submitterName}`} />
                  </TableCell>
                  <TableCell>{item.submitterName}</TableCell>
                  <TableCell>
                    <Link href={item.recipeHref} className="text-charcoal hover:underline" target="_blank">
                      {item.recipeTitle}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-xs truncate">{item.text}</TableCell>
                  <TableCell className="max-w-xs truncate">{item.answerText ?? "—"}</TableCell>
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

      <Dialog open={answerTarget !== null} onOpenChange={(open) => !open && setAnswerTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Answer question</h2>
          <p className="mt-1 text-small text-charcoal/70">
            Published publicly once approved. To decline a question publicly, write a polite reason here instead of rejecting it.
          </p>
          <Textarea className="mt-3" value={answerText} onChange={(event) => setAnswerText(event.target.value)} placeholder="Write an answer…" rows={4} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              disabled={!answerText.trim()}
              onClick={() => {
                if (!answerTarget) return;
                runAction(() => answerRecipeQaItem(answerTarget.id, answerText));
                setAnswerTarget(null);
              }}
            >
              Save answer
            </Button>
            <Button type="button" variant="outline" onClick={() => setAnswerTarget(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Reject question</h2>
          <p className="mt-1 text-small text-charcoal/70">Internal-only — the customer is never shown this reason.</p>
          <Textarea className="mt-3" value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Why this question is being rejected" rows={3} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="destructive"
              disabled={!rejectReason.trim()}
              onClick={() => {
                if (!rejectTarget) return;
                runAction(() => rejectRecipeQaItem(rejectTarget.id, rejectReason));
                setRejectTarget(null);
              }}
            >
              Reject
            </Button>
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
