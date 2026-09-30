import type { BlogPostAdminFormInput } from "@/validation/blog-admin.schema";

/** STORY-044. Fetch wrappers for /api/admin/blog/* — mirrors admin-recipe-client.ts's assertOk convention. */

function assertOk(response: Response, message: string): void {
  if (!response.ok) throw new Error(`${message} (${response.status})`);
}

async function assertOkWithServerMessage(response: Response, fallback: string): Promise<void> {
  if (response.ok) return;
  const body = await response.json().catch(() => ({ error: fallback }));
  throw new Error(body.error ?? fallback);
}

/** "Live"/"Scheduled" are display labels, not stored enum values — see blog-admin.service.ts. */
export type BlogPostAdminStatusFilter = "Draft" | "Scheduled" | "Live" | "Archived";
export type BlogCommentStatus = "Pending" | "Approved" | "Rejected" | "Hidden";

export interface AdminBlogPostListFilters {
  page?: number;
  pageSize?: number;
  status?: BlogPostAdminStatusFilter;
  search?: string;
}

export interface AdminBlogPostListRow {
  id: string;
  slug: string;
  title: string;
  status: "Draft" | "Published" | "Archived";
  publishedAt: string | null;
  updatedAt: string;
  author: { name: string };
}

export interface AdminBlogPostListResult {
  items: AdminBlogPostListRow[];
  total: number;
}

function postsQueryString(filters: AdminBlogPostListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchAdminBlogPosts(filters: AdminBlogPostListFilters): Promise<AdminBlogPostListResult> {
  const response = await fetch(`/api/admin/blog/posts?${postsQueryString(filters)}`);
  assertOk(response, "Failed to load blog posts");
  return response.json();
}

export interface BlogPostFormReferenceData {
  authors: { id: string; name: string; slug: string }[];
  tags: { id: string; name: string; slug: string }[];
}

export async function fetchBlogPostFormReferenceData(): Promise<BlogPostFormReferenceData> {
  const response = await fetch("/api/admin/blog/posts/reference-data");
  assertOk(response, "Failed to load reference data");
  return response.json();
}

export async function fetchAdminBlogPost(id: string) {
  const response = await fetch(`/api/admin/blog/posts/${id}`);
  assertOk(response, "Failed to load blog post");
  return response.json();
}

export async function createAdminBlogPost(input: BlogPostAdminFormInput) {
  const response = await fetch("/api/admin/blog/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to create blog post");
  return response.json();
}

export async function updateAdminBlogPost(id: string, input: BlogPostAdminFormInput) {
  const response = await fetch(`/api/admin/blog/posts/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await assertOkWithServerMessage(response, "Failed to save blog post");
  return response.json();
}

export async function deleteAdminBlogPost(id: string): Promise<void> {
  const response = await fetch(`/api/admin/blog/posts/${id}`, { method: "DELETE" });
  await assertOkWithServerMessage(response, "Failed to delete blog post");
}

async function postPostAction(id: string, action: string, fallback: string, body?: unknown) {
  const response = await fetch(`/api/admin/blog/posts/${id}/${action}`, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  await assertOkWithServerMessage(response, fallback);
  return response.json();
}

export const publishBlogPost = (id: string, publishedAt?: string) => postPostAction(id, "publish", "Failed to publish", publishedAt ? { publishedAt } : undefined);
export const archiveBlogPost = (id: string) => postPostAction(id, "archive", "Failed to archive");
export const restoreBlogPost = (id: string) => postPostAction(id, "restore", "Failed to restore");

export interface AdminBlogCommentListFilters {
  page?: number;
  pageSize?: number;
  postId?: string;
  status?: BlogCommentStatus;
  search?: string;
}

export interface AdminBlogCommentListRow {
  id: string;
  authorName: string;
  authorEmail: string;
  body: string;
  status: BlogCommentStatus;
  createdAt: string;
  post: { id: string; slug: string; title: string };
}

export interface AdminBlogCommentListResult {
  items: AdminBlogCommentListRow[];
  total: number;
}

function commentsQueryString(filters: AdminBlogCommentListFilters): string {
  const params = new URLSearchParams();
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  if (filters.postId) params.set("postId", filters.postId);
  if (filters.status) params.set("status", filters.status);
  if (filters.search) params.set("search", filters.search);
  return params.toString();
}

export async function fetchAdminBlogComments(filters: AdminBlogCommentListFilters): Promise<AdminBlogCommentListResult> {
  const response = await fetch(`/api/admin/blog/comments?${commentsQueryString(filters)}`);
  assertOk(response, "Failed to load comments");
  return response.json();
}

async function postCommentAction(id: string, action: string, fallback: string) {
  const response = await fetch(`/api/admin/blog/comments/${id}/${action}`, { method: "POST" });
  await assertOkWithServerMessage(response, fallback);
  return response.json();
}

export const approveBlogComment = (id: string) => postCommentAction(id, "approve", "Failed to approve comment");
export const rejectBlogComment = (id: string) => postCommentAction(id, "reject", "Failed to reject comment");
export const hideBlogComment = (id: string) => postCommentAction(id, "hide", "Failed to hide comment");
export const deleteBlogComment = (id: string) => postCommentAction(id, "delete", "Failed to delete comment");

export async function bulkModerateBlogComments(ids: string[], action: "approve" | "reject"): Promise<{ updated: string[]; skipped: string[] }> {
  const response = await fetch("/api/admin/blog/comments/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, action }),
  });
  await assertOkWithServerMessage(response, "Failed to bulk moderate comments");
  return response.json();
}
