"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckboxOption } from "@/components/storefront/listing/checkbox-option";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { AssetPickerDialog } from "@/components/admin/media/asset-picker-dialog";
import { BlogBodyEditor } from "@/components/admin/blog/blog-body-editor";
import { SeoFieldsPanel } from "@/components/admin/seo/seo-fields-panel";
import {
  archiveBlogPost,
  createAdminBlogPost,
  deleteAdminBlogPost,
  fetchAdminBlogPost,
  fetchBlogPostFormReferenceData,
  publishBlogPost,
  restoreBlogPost,
  updateAdminBlogPost,
} from "@/lib/api/admin-blog-client";
import { deriveEffectiveStatus } from "@/lib/blog-post-status";
import { blogPostAdminSchema, type BlogPostAdminFormInput } from "@/validation/blog-admin.schema";

const EMPTY_VALUES: BlogPostAdminFormInput = {
  slug: "",
  title: "",
  excerpt: "",
  heroImageUrl: "",
  bodyContent: "",
  authorId: "",
  tagIds: [],
};

function toLocalDatetimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** STORY-044. New vs. edit via an optional postId — both share this one form, mirroring admin-recipe-form.tsx's pattern. */
export function AdminBlogPostForm({ postId }: { postId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [heroPickerOpen, setHeroPickerOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const { data: referenceData } = useQuery({
    queryKey: ["admin-blog-posts-reference-data"],
    queryFn: fetchBlogPostFormReferenceData,
  });

  const { data: existingPost } = useQuery({
    queryKey: ["admin-blog-post", postId],
    queryFn: () => fetchAdminBlogPost(postId!),
    enabled: Boolean(postId),
    // Same reasoning as admin-recipe-form.tsx: a background refetch (e.g.
    // AssetPickerDialog stealing/returning window focus) must never race
    // an in-progress, unsaved edit.
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const {
    register,
    control,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BlogPostAdminFormInput>({ resolver: zodResolver(blogPostAdminSchema), defaultValues: EMPTY_VALUES });

  const initializedPostId = useRef<string | undefined>(undefined);

  useEffect(() => {
    if (!existingPost) return;
    if (initializedPostId.current === existingPost.id) return;
    initializedPostId.current = existingPost.id;
    reset({
      slug: existingPost.slug,
      title: existingPost.title,
      excerpt: existingPost.excerpt,
      heroImageUrl: existingPost.heroImageUrl ?? "",
      bodyContent: existingPost.bodyContent,
      authorId: existingPost.authorId,
      tagIds: existingPost.tags.map((t: { tag: { id: string } }) => t.tag.id),
    });
  }, [existingPost, reset]);

  const tagIds = watch("tagIds") ?? [];

  function toggleId(current: string[], id: string): string[] {
    return current.includes(id) ? current.filter((existing) => existing !== id) : [...current, id];
  }

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      if (postId) {
        await updateAdminBlogPost(postId, values);
        queryClient.invalidateQueries({ queryKey: ["admin-blog-post", postId] });
      } else {
        const created = await createAdminBlogPost(values);
        router.push(`/admin/blog/posts/${created.id}`);
      }
    } catch (error) {
      setServerError(error instanceof Error ? error.message : "Something went wrong. Please try again.");
    }
  });

  async function runAction(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      queryClient.invalidateQueries({ queryKey: ["admin-blog-post", postId] });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Action failed.");
    }
  }

  async function handleDelete() {
    await deleteAdminBlogPost(postId!);
    router.push("/admin/blog/posts");
  }

  const status: "Draft" | "Published" | "Archived" | undefined = existingPost?.status;
  const effectiveStatus = status ? deriveEffectiveStatus(status, existingPost?.publishedAt ?? null) : undefined;

  return (
    <form onSubmit={submit} noValidate>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-h2 font-heading text-charcoal">{postId ? "Edit post" : "New post"}</h1>
          {effectiveStatus && <Badge variant={effectiveStatus === "Live" ? "default" : effectiveStatus === "Archived" ? "outline" : "secondary"}>{effectiveStatus}</Badge>}
        </div>
        <div className="flex items-center gap-2">
          {postId && status && (
            <>
              {(status === "Draft" || status === "Published") && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setPublishAt(toLocalDatetimeInputValue(new Date()));
                    setPublishOpen(true);
                  }}
                >
                  {status === "Draft" ? "Publish" : "Reschedule"}
                </Button>
              )}
              {status === "Published" && (
                <Button type="button" variant="outline" size="sm" onClick={() => runAction(() => archiveBlogPost(postId))}>
                  Archive
                </Button>
              )}
              {status === "Archived" && (
                <Button type="button" variant="outline" size="sm" onClick={() => runAction(() => restoreBlogPost(postId))}>
                  Restore to Draft
                </Button>
              )}
              {status === "Draft" && (
                <Button type="button" variant="destructive" size="sm" onClick={handleDelete}>
                  Delete
                </Button>
              )}
              <Button type="button" variant="outline" size="sm" nativeButton={false} render={<Link href={`/admin/blog/posts/${postId}/preview`} />}>
                Preview
              </Button>
            </>
          )}
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>
      {serverError && <p className="mt-2 text-small text-destructive">{serverError}</p>}
      {actionError && <p className="mt-2 text-small text-destructive">{actionError}</p>}

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent>
          <h2 className="text-h4 font-heading text-charcoal">{status === "Draft" ? "Publish post" : "Reschedule post"}</h2>
          <p className="mt-1 text-small text-charcoal/70">
            Choose now to publish immediately, or a future date/time to schedule — the post stays hidden from the storefront until then.
          </p>
          <Label htmlFor="blog-publish-at" className="mt-3 block">
            Publish date &amp; time
          </Label>
          <Input id="blog-publish-at" type="datetime-local" value={publishAt} onChange={(event) => setPublishAt(event.target.value)} />
          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              onClick={() => {
                const isoDate = publishAt ? new Date(publishAt).toISOString() : undefined;
                runAction(() => publishBlogPost(postId!, isoDate));
                setPublishOpen(false);
              }}
            >
              {status === "Draft" ? "Publish" : "Reschedule"}
            </Button>
            <Button type="button" variant="outline" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="details" className="mt-6">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="body">Body</TabsTrigger>
          <TabsTrigger value="media">Media</TabsTrigger>
          <TabsTrigger value="seo">SEO</TabsTrigger>
        </TabsList>

        <TabsContent value="details" className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="blog-title">Title</Label>
            <Input id="blog-title" {...register("title")} />
            {errors.title && <p className="mt-1 text-small text-destructive">{errors.title.message}</p>}
          </div>
          <div>
            <Label htmlFor="blog-slug">Slug</Label>
            <Input id="blog-slug" {...register("slug")} />
            {errors.slug && <p className="mt-1 text-small text-destructive">{errors.slug.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="blog-excerpt">Excerpt</Label>
            <Textarea id="blog-excerpt" {...register("excerpt")} />
            {errors.excerpt && <p className="mt-1 text-small text-destructive">{errors.excerpt.message}</p>}
          </div>
          <div>
            <Label htmlFor="blog-author">Author</Label>
            <Controller
              control={control}
              name="authorId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="blog-author" className="w-full">
                    <SelectValue placeholder="Select an author" />
                  </SelectTrigger>
                  <SelectContent>
                    {(referenceData?.authors ?? []).map((author) => (
                      <SelectItem key={author.id} value={author.id}>
                        {author.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.authorId && <p className="mt-1 text-small text-destructive">{errors.authorId.message}</p>}
          </div>
          <div className="sm:col-span-2">
            <Label>Tags</Label>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border border-input p-2 sm:grid-cols-3">
              {(referenceData?.tags ?? []).map((tag) => (
                <CheckboxOption key={tag.id} label={tag.name} checked={tagIds.includes(tag.id)} onCheckedChange={() => setValue("tagIds", toggleId(tagIds, tag.id))} />
              ))}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="body" className="mt-4">
          <Controller control={control} name="bodyContent" render={({ field }) => <BlogBodyEditor id="blog-body" value={field.value} onChange={field.onChange} />} />
          {errors.bodyContent && <p className="mt-1 text-small text-destructive">{errors.bodyContent.message}</p>}
        </TabsContent>

        <TabsContent value="media" className="mt-4 space-y-4">
          <div>
            <Label htmlFor="blog-hero-image">Hero image URL</Label>
            <div className="flex gap-2">
              <Input id="blog-hero-image" {...register("heroImageUrl")} className="flex-1" />
              <Button type="button" size="sm" variant="outline" onClick={() => setHeroPickerOpen(true)}>
                Browse Library
              </Button>
            </div>
          </div>
          <AssetPickerDialog
            open={heroPickerOpen}
            onOpenChange={setHeroPickerOpen}
            onSelect={(asset) => {
              setValue("heroImageUrl", asset.url);
              setHeroPickerOpen(false);
            }}
          />
        </TabsContent>

        <TabsContent value="seo" className="mt-4">
          <SeoFieldsPanel entityType="BlogPost" entityId={postId ?? null} />
        </TabsContent>
      </Tabs>
    </form>
  );
}
