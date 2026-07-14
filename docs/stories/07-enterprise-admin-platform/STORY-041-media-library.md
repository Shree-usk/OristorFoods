# STORY-041: Media Library

**Status:** Draft
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Content Editor, Marketing Manager, SEO Specialist, Administrator, Super Administrator

## User Story
As a Content Editor, I want a centralized media library with folders, tags, and search, so that I can find and reuse existing images and videos across products, recipes, blog posts, and homepage content instead of re-uploading duplicates.
As an SEO Specialist, I want alt text required on every image before it can be used on a public page, so that the site stays accessible and search-friendly by default.

## Description
This story delivers the Media Library console module described in `docs/blueprint.md` Section 7 ("folders, tagging, search, bulk upload, compression, automatic WebP conversion, cropping, resizing, alt text, version history"). It is the single source of truth for "manage web and project images" and is a hard dependency for every other content module in this epic that has an image/video field — Products (STORY-040), Homepage Visual Builder (STORY-042), Recipes (STORY-043), and Blog (STORY-044) — none of which are permitted to build their own raw file uploader.

## Acceptance Criteria
- [ ] Admins can create, rename, delete, and nest folders to organize assets
- [ ] Every asset supports one or more tags; the library can be filtered/searched by tag, filename, folder, upload date, uploader, and file type
- [ ] Bulk upload supports multi-file drag-and-drop with a per-file progress indicator and per-file error handling (a failed file doesn't block the rest of the batch)
- [ ] Every uploaded image is automatically compressed and converted to WebP, while the original file remains downloadable
- [ ] An in-browser cropping/resizing tool offers common presets (hero, thumbnail, square, Open Graph image) plus a custom aspect ratio option, and saves crop variants alongside the original
- [ ] Alt text is a required field before an image asset can be selected for use on any public-facing page — the shared asset picker enforces this, it is not just a form-level nicety
- [ ] Replacing an asset's file preserves prior versions in a retrievable version history, recording who replaced it and when, with rollback to a prior version
- [ ] A reusable `AssetPickerDialog` component is the only sanctioned way other admin modules select an image/video/document — STORY-040/042/043/044 consume it rather than building independent uploaders
- [ ] Uploads are validated against allowed MIME types (JPG, PNG, WebP, SVG, MP4, PDF) and a maximum file size, with a clear error for rejected files
- [ ] Before an asset can be deleted, the system shows which content items currently reference it and blocks/warns against deletion of an in-use asset

## Tasks
- [ ] **Database:** `MediaAsset` (filename, url, mimeType, sizeBytes, width, height, folderId, altText, uploadedById, createdAt), `MediaFolder` (name, parentId), `MediaAssetTag` (join table), `MediaAssetVersion` (assetId, url, replacedAt, replacedById), and a usage-lookup mechanism (query across referencing tables, or an explicit `MediaAssetUsage` join maintained on save by consuming modules).
- [ ] **API:** `/api/admin/media` (list/search), `/api/admin/media/upload`, `/api/admin/media/[id]` (update metadata/delete), `/api/admin/media/folders`, `/api/admin/media/[id]/versions`, `/api/admin/media/[id]/usage`.
- [ ] **Service/Backend:** `media.service.ts` implementing the upload pipeline (validate → compress → convert to WebP → generate crop/resize variants → persist), `folder.service.ts`, and a `checkAssetUsage(assetId)` helper other modules' repositories register against.
- [ ] **Frontend:** `src/app/(admin)/media-library/page.tsx` (folder tree + asset grid), `AssetUploadDropzone`, `AssetCropperModal`, `AssetPickerDialog` (the shared, reusable picker), `AssetDetailPanel` (alt text, tags, version history, usage list).
- [ ] **Validation:** Zod schema for upload metadata; required-alt-text rule enforced server-side, not just in the form; allowed-MIME-type and max-size checks.
- [ ] **Testing:** Unit tests for the compression/WebP conversion pipeline (mocked image processing) and the usage-before-delete guard; e2e test bulk upload → crop → alt text → insert into a product's image field via `AssetPickerDialog`.
- [ ] **Documentation:** Document the asset variant naming convention (e.g. `{id}-hero.webp`, `{id}-thumb.webp`) and the `AssetPickerDialog` integration contract for consuming modules.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions

## References
- `docs/blueprint.md` Section 7 ("Media Library" console module bullet)
- `docs/blueprint.md` Section 6 (accessibility — alt text requirement)
- `.claude/skills/admin-console-module/SKILL.md`
