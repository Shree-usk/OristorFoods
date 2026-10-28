"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import {
  createAdminBlogAuthor,
  deleteAdminBlogAuthor,
  fetchAdminBlogAuthors,
  updateAdminBlogAuthor,
  type AdminBlogAuthor,
} from "@/lib/api/admin-blog-client";
import { toastManager } from "@/lib/toast";
import type { BlogAuthorAdminFormInput } from "@/validation/blog-admin.schema";

const EMPTY_FORM: BlogAuthorAdminFormInput = { name: "", slug: "", bio: "", avatarUrl: "" };

/** Flat list + dialog create/edit, mirroring admin-categories-view.tsx's own convention for simple reference data with no workflow state. */
export function AdminBlogAuthorsView() {
  const queryClient = useQueryClient();
  const { data: authors, isLoading } = useQuery({ queryKey: ["admin-blog-authors"], queryFn: fetchAdminBlogAuthors });

  const [editing, setEditing] = useState<AdminBlogAuthor | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<BlogAuthorAdminFormInput>(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);

  const dialogOpen = editing !== null || creating;

  function openCreate() {
    setForm(EMPTY_FORM);
    setCreating(true);
    setEditing(null);
    setError(null);
  }

  function openEdit(author: AdminBlogAuthor) {
    setForm({ name: author.name, slug: author.slug, bio: author.bio ?? "", avatarUrl: author.avatarUrl ?? "" });
    setEditing(author);
    setCreating(false);
    setError(null);
  }

  function closeDialog() {
    setEditing(null);
    setCreating(false);
  }

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      if (editing) {
        await updateAdminBlogAuthor(editing.id, form);
        toastManager.add({ title: "Author saved" });
      } else {
        await createAdminBlogAuthor(form);
        toastManager.add({ title: "Author created" });
      }
      queryClient.invalidateQueries({ queryKey: ["admin-blog-authors"] });
      closeDialog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save author.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(author: AdminBlogAuthor) {
    try {
      await deleteAdminBlogAuthor(author.id);
      toastManager.add({ title: "Author deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin-blog-authors"] });
    } catch (err) {
      toastManager.add({ title: err instanceof Error ? err.message : "Failed to delete author." });
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-h2 font-heading text-charcoal">Blog authors</h1>
        <Button type="button" onClick={openCreate}>
          Add author
        </Button>
      </div>
      <p className="mt-1 text-small text-charcoal/70">The byline shown on blog posts and recipe articles. A post can&apos;t be saved until at least one author exists.</p>

      <div className="mt-6">
        {isLoading ? (
          <p className="text-small text-charcoal/70">Loading…</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Posts</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {!authors || authors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-small text-charcoal/70">
                    No authors yet.
                  </TableCell>
                </TableRow>
              ) : (
                authors.map((author) => (
                  <TableRow key={author.id}>
                    <TableCell>{author.name}</TableCell>
                    <TableCell>{author.slug}</TableCell>
                    <TableCell>{author._count.posts}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button type="button" size="sm" variant="ghost" onClick={() => openEdit(author)}>
                          Edit
                        </Button>
                        <Button type="button" size="sm" variant="ghost" onClick={() => handleDelete(author)} disabled={author._count.posts > 0}>
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent>
          <h2 className="text-h3 font-heading text-charcoal">{editing ? "Edit author" : "Add author"}</h2>
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <Label htmlFor="author-name">Name</Label>
              <Input id="author-name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="author-slug">Slug</Label>
              <Input id="author-slug" value={form.slug} onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="author-bio">Bio</Label>
              <Textarea id="author-bio" value={form.bio ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, bio: event.target.value }))} />
            </div>
            <div>
              <Label htmlFor="author-avatar">Avatar</Label>
              <div className="flex gap-2">
                <Input id="author-avatar" value={form.avatarUrl ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, avatarUrl: event.target.value }))} className="flex-1" />
                <Button type="button" size="sm" variant="outline" onClick={() => setAvatarPickerOpen(true)}>
                  Browse Library
                </Button>
              </div>
            </div>

            {error && <p className="text-small text-destructive">{error}</p>}
            <div className="flex gap-2">
              <Button type="button" onClick={handleSave} disabled={isSaving || !form.name.trim() || !form.slug.trim()}>
                {isSaving ? "Saving…" : "Save"}
              </Button>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AssetPickerDialog
        open={avatarPickerOpen}
        onOpenChange={setAvatarPickerOpen}
        onSelect={(asset) => {
          setForm((prev) => ({ ...prev, avatarUrl: asset.url }));
          setAvatarPickerOpen(false);
        }}
      />
    </div>
  );
}
