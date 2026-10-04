"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  createPolicyDocumentAdmin,
  deletePolicyDocumentAdmin,
  fetchPolicyDocuments,
  updatePolicyDocumentAdmin,
  type PolicyDocument,
  type PolicyDocumentInput,
} from "@/lib/api/admin-policy-document-client";

function emptyForm(): PolicyDocumentInput {
  return { slug: "", title: "", content: "" };
}

function toFormInput(document: PolicyDocument): PolicyDocumentInput {
  return { slug: document.slug, title: document.title, content: document.content };
}

/**
 * STORY-063. The single canonical policy content source the Support
 * Assistant grounds returns/refund/exchange answers in — ships with
 * no seeded rows (see docs/architecture-decisions.md); the business
 * authors the real policy text here.
 */
export function PolicyDocumentsPanel() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PolicyDocumentInput>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<PolicyDocument | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: documents } = useQuery({ queryKey: ["admin-policy-documents"], queryFn: fetchPolicyDocuments });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin-policy-documents"] });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setActionError(null);
    setDialogOpen(true);
  }

  function openEdit(document: PolicyDocument) {
    setEditingId(document.id);
    setForm(toFormInput(document));
    setActionError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    try {
      if (editingId) {
        await updatePolicyDocumentAdmin(editingId, form);
      } else {
        await createPolicyDocumentAdmin(form);
      }
      setDialogOpen(false);
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the policy document.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deletePolicyDocumentAdmin(deleteTarget.id);
      setDeleteTarget(null);
      invalidate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete the policy document.");
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <p className="text-small text-muted-foreground">
          The AI Customer Support Assistant grounds returns/refund/exchange answers in this content — it never generates policy text on its own.
        </p>
        <Button type="button" onClick={openCreate}>
          New document
        </Button>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}

      <Table className="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Slug</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(documents ?? []).map((document) => (
            <TableRow key={document.id}>
              <TableCell>{document.slug}</TableCell>
              <TableCell>{document.title}</TableCell>
              <TableCell>{new Date(document.updatedAt).toLocaleDateString()}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => openEdit(document)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" type="button" onClick={() => setDeleteTarget(document)}>
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {documents?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-small text-charcoal/70">
                No policy documents yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent aria-label={editingId ? "Edit policy document" : "New policy document"} className="sm:max-w-xl">
          <h2 className="text-h4 font-heading text-charcoal">{editingId ? "Edit document" : "New document"}</h2>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="policy-slug">Slug</Label>
              <Input id="policy-slug" required placeholder="returns-refunds-exchanges" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="policy-title">Title</Label>
              <Input id="policy-title" required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="policy-content">Content</Label>
              <Textarea id="policy-content" required rows={12} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} />
            </div>
            <Button type="submit" className="w-fit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Delete &ldquo;{deleteTarget?.title}&rdquo;?</h2>
          <p className="mt-2 text-small text-charcoal/70">
            The Support Assistant will no longer be able to ground answers in this document. This cannot be undone.
          </p>
          <Button type="button" variant="destructive" className="mt-4 w-fit" onClick={handleDelete}>
            Delete document
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
