"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  createGlossaryTermAdmin,
  deleteGlossaryTermAdmin,
  fetchGlossaryTerms,
  updateGlossaryTermAdmin,
  type GlossaryTerm,
  type GlossaryTermInput,
} from "@/lib/api/admin-search-glossary-client";

function emptyForm(): GlossaryTermInput {
  return { term: "", canonicalTerm: "", targetType: null, targetId: null };
}

function toFormInput(term: GlossaryTerm): GlossaryTermInput {
  return { term: term.term, canonicalTerm: term.canonicalTerm, targetType: term.targetType, targetId: term.targetId };
}

/**
 * STORY-061. Sinhala/Tamil transliteration + synonym glossary, admin
 * CRUD (Admin Console Principle — ships with zero seeded entries,
 * see docs/architecture-decisions.md). targetType/targetId are
 * optional: most terms are plain synonym expansions with no single
 * target.
 */
export function AdminSearchGlossaryView() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<GlossaryTermInput>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<GlossaryTerm | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: terms } = useQuery({ queryKey: ["admin-search-glossary"], queryFn: fetchGlossaryTerms });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm());
    setActionError(null);
    setDialogOpen(true);
  }

  function openEdit(term: GlossaryTerm) {
    setEditingId(term.id);
    setForm(toFormInput(term));
    setActionError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);
    const payload: GlossaryTermInput = {
      term: form.term.trim(),
      canonicalTerm: form.canonicalTerm.trim(),
      targetType: form.targetType?.trim() || null,
      targetId: form.targetId?.trim() || null,
    };
    try {
      if (editingId) {
        await updateGlossaryTermAdmin(editingId, payload);
      } else {
        await createGlossaryTermAdmin(payload);
      }
      setDialogOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-search-glossary"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to save the glossary term.");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setActionError(null);
    try {
      await deleteGlossaryTermAdmin(deleteTarget.id);
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ["admin-search-glossary"] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete the glossary term.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h2 font-heading text-charcoal">Search Glossary</h1>
          <p className="mt-1 text-small text-charcoal/70">
            Sinhala/Tamil transliterations and synonyms that expand what a customer&apos;s search query matches.
          </p>
        </div>
        <Button type="button" onClick={openCreate}>
          New term
        </Button>
      </div>

      {actionError && <p className="mt-3 text-small text-destructive">{actionError}</p>}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Term</TableHead>
            <TableHead>Canonical term</TableHead>
            <TableHead>Target</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {(terms ?? []).map((term) => (
            <TableRow key={term.id}>
              <TableCell>{term.term}</TableCell>
              <TableCell>{term.canonicalTerm}</TableCell>
              <TableCell>{term.targetType ? `${term.targetType}: ${term.targetId}` : "—"}</TableCell>
              <TableCell>
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" type="button" onClick={() => openEdit(term)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" type="button" onClick={() => setDeleteTarget(term)}>
                    Delete
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {terms?.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-small text-charcoal/70">
                No glossary terms yet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">{editingId ? "Edit term" : "New term"}</h2>
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
            <div>
              <Label htmlFor="glossary-term">Term</Label>
              <Input id="glossary-term" required value={form.term} onChange={(event) => setForm({ ...form, term: event.target.value })} />
            </div>
            <div>
              <Label htmlFor="glossary-canonical-term">Canonical term</Label>
              <Input
                id="glossary-canonical-term"
                required
                value={form.canonicalTerm}
                onChange={(event) => setForm({ ...form, canonicalTerm: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="glossary-target-type">Target type (optional)</Label>
              <Input
                id="glossary-target-type"
                value={form.targetType ?? ""}
                onChange={(event) => setForm({ ...form, targetType: event.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="glossary-target-id">Target id (optional)</Label>
              <Input
                id="glossary-target-id"
                value={form.targetId ?? ""}
                onChange={(event) => setForm({ ...form, targetId: event.target.value })}
              />
            </div>
            <Button type="submit" className="w-fit">
              Save
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">Delete &ldquo;{deleteTarget?.term}&rdquo;?</h2>
          <p className="mt-2 text-small text-charcoal/70">This cannot be undone.</p>
          <Button type="button" variant="destructive" className="mt-4 w-fit" onClick={handleDelete}>
            Delete term
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
