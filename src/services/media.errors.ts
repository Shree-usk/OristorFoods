export type MediaErrorCode = "not_found" | "missing_alt_text" | "folder_not_found" | "folder_not_empty" | "upload_validation";

export class MediaServiceError extends Error {
  constructor(
    public readonly code: MediaErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MediaServiceError";
  }
}

export class MediaAssetNotFoundError extends MediaServiceError {
  constructor() {
    super("not_found", "Media asset not found.");
  }
}

/** AC: alt text is required before an asset can be selected for use — enforced server-side, not just a form-level nicety. */
export class MediaAssetMissingAltTextError extends MediaServiceError {
  constructor() {
    super("missing_alt_text", "This asset needs alt text before it can be selected.");
  }
}

export class MediaFolderNotFoundError extends MediaServiceError {
  constructor() {
    super("folder_not_found", "Media folder not found.");
  }
}

export class MediaFolderNotEmptyError extends MediaServiceError {
  constructor() {
    super("folder_not_empty", "This folder still contains subfolders or assets — move or remove them first.");
  }
}

/** Carries a per-file reason, distinct from the batch-level result upload validation collects into (see media.service.ts::uploadAssets). */
export class MediaUploadValidationError extends MediaServiceError {
  constructor(message: string) {
    super("upload_validation", message);
  }
}
