export type CollectionErrorCode = "collection_not_found" | "collection_slug_conflict";

export class CollectionError extends Error {
  constructor(
    public readonly code: CollectionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CollectionError";
  }
}

export class CollectionNotFoundError extends CollectionError {
  constructor() {
    super("collection_not_found", "Collection not found.");
  }
}

export class CollectionSlugConflictError extends CollectionError {
  constructor() {
    super("collection_slug_conflict", "A collection with this slug already exists.");
  }
}
