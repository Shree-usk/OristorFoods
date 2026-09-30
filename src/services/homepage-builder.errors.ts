export type HomepageBuilderErrorCode =
  | "layout_not_found"
  | "section_not_found"
  | "banner_not_found"
  | "layout_not_draft"
  | "duplicate_hero_banner_section"
  | "hero_banner_duplicate_not_allowed"
  | "no_archived_layout";

export class HomepageBuilderError extends Error {
  constructor(
    public readonly code: HomepageBuilderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "HomepageBuilderError";
  }
}

export class HomepageLayoutNotFoundError extends HomepageBuilderError {
  constructor() {
    super("layout_not_found", "Homepage layout not found.");
  }
}

export class HomepageSectionNotFoundError extends HomepageBuilderError {
  constructor() {
    super("section_not_found", "Homepage section not found.");
  }
}

export class HeroBannerSlideNotFoundError extends HomepageBuilderError {
  constructor() {
    super("banner_not_found", "Hero banner slide not found.");
  }
}

/** Only a Draft layout may be deleted or have its sections/banners edited — Published/Archived layouts are an immutable publish history (AC: "the previous layout is retained and can be rolled back to"). */
export class HomepageLayoutNotDraftError extends HomepageBuilderError {
  constructor() {
    super("layout_not_draft", "Only a Draft layout can be modified or deleted.");
  }
}

/** A layout may have at most one HeroBanner-type section — its own multi-slide model covers "multiple banners", not multiple sections. */
export class DuplicateHeroBannerSectionError extends HomepageBuilderError {
  constructor() {
    super("duplicate_hero_banner_section", "This layout already has a Hero Banner section — add more banners within it instead.");
  }
}

/** duplicateSection is for the 10 light-touch types; a Hero Banner section's slides are duplicated individually instead. */
export class HeroBannerSectionDuplicateNotAllowedError extends HomepageBuilderError {
  constructor() {
    super("hero_banner_duplicate_not_allowed", "Duplicate individual banner slides instead of the whole Hero Banner section.");
  }
}

export class NoArchivedLayoutError extends HomepageBuilderError {
  constructor() {
    super("no_archived_layout", "There is no previously-published layout to roll back to.");
  }
}
