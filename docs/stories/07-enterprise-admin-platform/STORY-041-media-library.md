# STORY-041: Media Library

**Status:** Core landed (2026-09-30) — see `docs/architecture-decisions.md`'s 2026-09-30 STORY-041 entry for the full write-up, including the `StorageProvider` abstraction, the safe-filename/MIME-allowlist security approach, the `AssetPickerDialog` integration contract, the STORY-040 retrofit, and the bugs found and fixed while building this (the reset-on-refetch bug, the `public/`-write-triggers-Fast-Refresh bug, and the Turbopack dev-mode lazy-compilation race).
**Epic:** 07 — Enterprise / Admin Platform
**Priority:** High
**Persona(s):** Content Editor, Marketing Manager, SEO Specialist, Administrator, Super Administrator

## User Story
As a Content Editor, I want a centralized media library with folders, tags, and search, so that I can find and reuse existing images and videos across products, recipes, blog posts, and homepage content instead of re-uploading duplicates.
As an SEO Specialist, I want alt text required on every image before it can be used on a public page, so that the site stays accessible and search-friendly by default.

## Description
This story delivers the Media Library console module described in `docs/blueprint.md` Section 7 ("folders, tagging, search, bulk upload, compression, automatic WebP conversion, cropping, resizing, alt text, version history"). It is the single source of truth for "manage web and project images" and is a hard dependency for every other content module in this epic that has an image/video field — Products (STORY-040), Homepage Visual Builder (STORY-042), Recipes (STORY-043), and Blog (STORY-044) — none of which are permitted to build their own raw file uploader.

## Acceptance Criteria
- [x] Admins can create, rename, and delete folders to organize assets. **Deviation:** nesting (`parentId`/`children` on `MediaFolder`) is modeled in the schema and the repository/tree-building support it, but the frontend renders a flat folder list this pass — a UI-only gap, not a data-model one, since the underlying self-relation is already there.
- [x] Every asset supports one or more tags; the library is filterable/searchable by tag, folder, and file type, and searchable by filename. **Deviation:** upload-date and uploader are not yet exposed as filter controls (both are stored on every `MediaAsset` row and visible on the asset detail panel — just not wired into the filter bar).
- [x] Bulk upload supports multi-file selection with per-file error handling (a failed file doesn't block the rest of the batch — verified live with a mixed valid/invalid-MIME-type batch). **Deviation:** no literal per-file byte-progress bar (each file instead gets a pending/done/error status badge) — `fetch` doesn't expose upload progress without extra plumbing disproportionate to this pass; drag-and-drop is not implemented, upload is via a file-picker button.
- [ ] **Deferred to the follow-up sweep** (see `docs/architecture-decisions.md`'s 2026-09-30 entry): automatic compression/WebP conversion — needs the `sharp` dependency, not yet added.
- [ ] **Deferred to the follow-up sweep:** the in-browser cropping/resizing tool.
- [x] Alt text is required before an image asset can be selected via `AssetPickerDialog` — enforced server-side in `media.service.ts::selectAssetForPicker` (the dedicated select endpoint), not just a form-level nicety, and verified with an e2e test that the enforcement holds independent of the UI.
- [ ] **Deferred to the follow-up sweep:** version history with rollback on file replacement.
- [x] `AssetPickerDialog` is a genuinely shared, reusable component (`mode: "manage" | "picker"` on the same underlying `MediaAssetBrowser`). STORY-040's product form is its first real consumer (Media tab's "Browse Library" button, additive alongside the existing manual URL input); STORY-042/043/044 adopt it when they're built.
- [x] Uploads are validated against an allowed-MIME-type list (JPEG, PNG, WebP, SVG, MP4, PDF) and a 20MB size cap, with a clear per-file error for rejected files — enforced server-side in `media.service.ts`, verified live with a rejected `.txt` upload.
- [ ] **Deferred to the follow-up sweep:** usage-before-delete guard. Retrofitting every existing image/video field (`ProductImage.url`, `Recipe.heroImage`, etc. — all plain strings today) to a `MediaAsset` FK is a large cross-cutting migration disproportionate to this pass; `deleteFolder` still unconditionally rejects while non-empty (`MediaFolderNotEmptyError`), which is a narrower, cheaper safeguard than true usage tracking.

## Tasks
- [x] **Database:** `MediaAsset` (filename, originalName, url, mimeType, type, sizeBytes, width/height nullable, altText nullable, folderId, tags, uploadedById), `MediaFolder` (name, self-relation `parentId`/`children`), `MediaAssetTag` (unique name, many-to-many). **Deviation:** no `MediaAssetVersion` model and no usage-lookup mechanism — both belong to the deferred version-history and usage-guard features above.
- [x] **API:** `GET /api/admin/media` (list/search/filter), `POST /api/admin/media/upload`, `GET`/`PATCH`/`DELETE /api/admin/media/[id]`, `POST /api/admin/media/[id]/select` (the alt-text-enforcing picker endpoint), `GET /api/admin/media/tags`, `GET`/`POST /api/admin/media/folders`, `PATCH`/`DELETE /api/admin/media/folders/[id]`. **Deviation:** no `/versions` or `/usage` sub-routes (deferred features).
- [x] **Service/Backend:** `media.service.ts` (upload validation → safe-filename generation → `StorageProvider.upload` → persist, per-file error collection, alt-text-gated selection, delete, tags, folder CRUD), all permission-gated (`MediaLibrary` module) and audit-logged. **Deviation:** the upload pipeline is validate → persist — no compress/WebP/crop-variant steps (deferred features); storage goes through a new `StorageProvider` abstraction (`src/services/storage/`) rather than writing directly, since no storage/hosting provider is confirmed yet (blueprint.md Section 10) — see the architecture-decisions.md entry for why this mirrors STORY-026's payment-provider pattern.
- [x] **Frontend:** `src/app/(admin)/admin/media/page.tsx` (folder sidebar + asset grid — actual path differs from the task list's stale `(admin)/media-library/page.tsx`, matching STORY-040's established `(admin)/admin/<module>` prefix), `MediaAssetBrowser` (the shared core, `manage`/`picker` modes), `AssetPickerDialog`, `AssetDetailPanel`/`AssetDetailForm` (alt text, tags, delete). **Deviation:** no `AssetUploadDropzone` (upload is a file-picker button, not drag-and-drop) and no `AssetCropperModal` (deferred feature); no version-history/usage list on the detail panel (deferred features).
- [x] **Validation:** `src/validation/media.schema.ts` (upload metadata, update, folder create/rename, list query). Required-alt-text is enforced in the service (`selectAssetForPicker`), not Zod, since it's a selection-time rule, not an upload-time or update-time shape rule. MIME-type/size checks run in the service against the actual uploaded `File`, not something Zod validates from a JSON body.
- [x] **Testing:** `tests/unit/media-service.test.ts` (5 tests: mixed valid/invalid upload batch, alt-text selection gate, delete removing DB row + file, folder-delete-while-non-empty rejection, permission denial) against the real `LocalDiskStorageProvider`, not a mock. `tests/e2e/admin-media.spec.ts` (2 tests: full lifecycle including picking an asset into the STORY-040 product form via `AssetPickerDialog`; a Viewer-only admin can browse but the upload route denies server-side). **Deviation:** no crop step in the e2e test (deferred feature).
- [x] **Documentation:** `docs/architecture-decisions.md`'s 2026-09-30 STORY-041 entry covers the `StorageProvider` abstraction and why, the safe-filename/MIME-allowlist approach, the `AssetPickerDialog` integration contract, the STORY-040 retrofit, and the deferred-items rationale. **Deviation:** no separate asset-variant-naming-convention doc, since no variants (WebP/crop) are generated yet — that documentation lands with the deferred compression/cropping work.

## Dependencies
- STORY-001, STORY-002, STORY-003 (Foundation)
- STORY-038 (Admin Auth & RBAC) — gates this module's actions

## References
- `docs/blueprint.md` Section 7 ("Media Library" console module bullet)
- `docs/blueprint.md` Section 6 (accessibility — alt text requirement)
- `.claude/skills/admin-console-module/SKILL.md`
