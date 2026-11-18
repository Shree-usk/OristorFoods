export type FoodAcademyAdminErrorCode =
  | "category_not_found"
  | "category_slug_conflict"
  | "category_in_use"
  | "entry_not_found"
  | "entry_slug_conflict"
  | "entry_publish_readiness"
  | "entry_requires_sections_for_course";

export class FoodAcademyAdminError extends Error {
  constructor(
    public readonly code: FoodAcademyAdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "FoodAcademyAdminError";
  }
}

export class FoodAcademyCategoryNotFoundError extends FoodAcademyAdminError {
  constructor() {
    super("category_not_found", "Food Academy category not found.");
  }
}

export class FoodAcademyCategorySlugConflictError extends FoodAcademyAdminError {
  constructor(public readonly slug: string) {
    super("category_slug_conflict", `A category with slug "${slug}" already exists.`);
  }
}

/** A category still assigned to entries can't be deleted — reassign or delete those entries first, matching the "refuse rather than orphan content" convention used elsewhere (e.g. recipe categories). */
export class FoodAcademyCategoryInUseError extends FoodAcademyAdminError {
  constructor() {
    super("category_in_use", "This category has entries assigned to it — reassign or delete them first.");
  }
}

export class FoodAcademyEntryNotFoundError extends FoodAcademyAdminError {
  constructor() {
    super("entry_not_found", "Food Academy entry not found.");
  }
}

export class FoodAcademyEntrySlugConflictError extends FoodAcademyAdminError {
  constructor(public readonly slug: string) {
    super("entry_slug_conflict", `An entry with slug "${slug}" already exists.`);
  }
}

export class FoodAcademyEntryPublishReadinessError extends FoodAcademyAdminError {
  constructor(public readonly missing: string[]) {
    super("entry_publish_readiness", `Cannot publish — missing: ${missing.join(", ")}.`);
  }
}

/** A Course entry's real content lives entirely in its sections — unlike Article/Guide, which may rely on bodyContent alone. */
export class FoodAcademyCourseRequiresSectionsError extends FoodAcademyAdminError {
  constructor() {
    super("entry_requires_sections_for_course", "A Course entry needs at least one section.");
  }
}
