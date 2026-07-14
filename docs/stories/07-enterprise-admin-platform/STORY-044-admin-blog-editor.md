# STORY-044: Admin Blog Editor

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** Medium
**Persona(s):** Content Editor, SEO Specialist, Marketing Manager, Super Administrator

## User Story
As a Content Editor, I want a rich text editor to author, schedule, and tag blog posts with an assigned author, so that I can publish brand storytelling content on a regular cadence without developer help.
As a Content Editor, I want to moderate comments submitted on blog posts, so that public discussion under our content stays on-brand and free of spam.

## Description
This story delivers the Blog console module from `docs/blueprint.md` Section 7 ("rich text editor, scheduling, authors, tags, comment moderation"). It is the admin authoring and moderation counterpart to the customer-facing blog defined in STORY-021, and plugs into the shared CMS workflow engine (STORY-053) for its review/publish state where a review step is required.

## Acceptance Criteria
- [ ] A rich text (WYSIWYG) editor supports headings, inline formatting, images/embeds (via Media Library), links, lists, and blockquotes, and persists content in a structured (not raw HTML string) format
- [ ] Post metadata includes: title, slug, excerpt, featured image, assigned author (any admin user with Content Editor role or above), category/tags, and SEO fields (meta title/description/OG image)
- [ ] A post can be saved as Draft, scheduled for a future publish date/time, or published immediately
- [ ] Post status follows Draft → Scheduled → Published → Archived, using STORY-053's shared CMS workflow engine where a review step is configured
- [ ] A comment moderation queue lists pending customer comments per post with Approve, Reject, Reply, and Delete actions, plus a spam flag
- [ ] Bulk approve/reject is available on a filtered/selected set of pending comments
- [ ] The rendered post byline shows the assigned author's name and avatar, sourced from their admin user profile
- [ ] The editor autosaves a draft periodically while the admin is actively editing, to prevent content loss

## Tasks
- [ ] **Database:** `BlogPost` (title, slug, excerpt, bodyJson, featuredImageId, authorId, status, publishedAt, scheduledAt, SEO fields), `BlogTag` (with a join table to `BlogPost`), `BlogComment` (postId, customerId, body, status PENDING/APPROVED/REJECTED/SPAM, createdAt).
- [ ] **API:** `/api/admin/blog/posts` (CRUD + `/publish` + `/schedule`), `/api/admin/blog/comments` (list/filter + moderation actions).
- [ ] **Service/Backend:** `blog-admin.service.ts` (post CRUD, autosave persistence, workflow delegated to STORY-053), `comment-moderation.service.ts` (designed to share its core approve/reject/reply/spam primitives with STORY-045's unified review-and-comment moderation console rather than duplicating that logic).
- [ ] **Frontend:** `src/app/(admin)/blog/posts/page.tsx` (list) and `[id]/page.tsx` (rich text editor, using e.g. Tiptap), `src/app/(admin)/blog/comments/page.tsx` (moderation queue with bulk actions).
- [ ] **Validation:** Zod schemas for post fields (title/slug/excerpt length limits, valid author reference) and comment moderation action payloads.
- [ ] **Testing:** Unit tests for autosave debounce/conflict handling and schedule-date validation (cannot schedule in the past); e2e test author → schedule → publish; e2e test comment approve/reject and confirm the approved comment appears under the storefront post.
- [ ] **Documentation:** Document the rich text JSON storage schema so STORY-021's storefront rendering stays compatible as the editor evolves.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions
- STORY-041 (Media Library) — post images and embeds
- STORY-053 (CMS Workflow & Versioning) — review/approval/publish state machinery

## References
- `docs/blueprint.md` Section 7 ("Blog" console module bullet)
- `docs/blueprint.md` Section 4/5 (blog content requirements)
