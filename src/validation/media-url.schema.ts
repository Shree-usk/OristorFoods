import { z } from "zod";

/**
 * Accepts either an absolute URL (typed in directly) or a root-relative
 * same-origin path. The latter is required: every asset selected via the
 * Media Library picker is one — LocalDiskStorageProvider returns
 * `/media-files/<filename>`, never a scheme-qualified URL (see
 * local-disk-storage.provider.ts). Plain `.url()` rejects that path, which
 * silently failed every save of a Media-Library-sourced image/video until
 * this was found and fixed (see docs/architecture-decisions.md, 2026-10-10
 * "Product Media tab silently rejected every Media-Library image").
 */
export const mediaUrlSchema = z
  .string()
  .trim()
  .min(1, "URL is required.")
  .refine((value) => {
    if (value.startsWith("/")) return true;
    try {
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }, "Enter a valid URL, or pick one from the Media Library.");

/** Same rule, but the field itself is optional/nullable (e.g. a category image, unlike a required product image). */
export const optionalMediaUrlSchema = mediaUrlSchema.optional().nullable().or(z.literal(""));
