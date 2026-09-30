/**
 * Provider-agnostic file storage contract (STORY-041). The concrete cloud
 * storage provider is an OPEN BUSINESS DECISION (docs/blueprint.md Section
 * 10, "hosting/cloud provider specifics") — `LocalDiskStorageProvider` is
 * the only implementation by design, not a gap, mirroring
 * `src/services/payment/payment-provider.interface.ts`'s exact resolution
 * for the same "unconfirmed external dependency" situation. Any future
 * concrete adapter (S3, Cloudinary, Vercel Blob, ...) implements this same
 * interface; `media.service.ts::getActiveStorageProvider` is the one place
 * that changes.
 */

export interface StorageUploadInput {
  /** The file's raw bytes — already validated (MIME type, size) by the caller. */
  buffer: Buffer;
  /** A pre-generated safe, randomized on-disk name — never the raw uploaded filename. */
  safeFilename: string;
}

export interface StorageUploadResult {
  /** A public, directly fetchable URL for the stored file. */
  url: string;
}

export interface StorageProvider {
  readonly name: string;
  upload(input: StorageUploadInput): Promise<StorageUploadResult>;
  /** Tolerant of "already gone" — deleting a file that doesn't exist is not an error. */
  delete(url: string): Promise<void>;
}
