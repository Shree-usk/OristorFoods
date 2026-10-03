export type NavigationErrorCode =
  | "menu_not_found"
  | "item_not_found"
  | "no_archived_menu"
  | "invalid_link_target"
  | "max_depth_exceeded"
  | "invalid_content_block";

export class NavigationError extends Error {
  constructor(
    public readonly code: NavigationErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "NavigationError";
  }
}

export class MenuNotFoundError extends NavigationError {
  constructor() {
    super("menu_not_found", "Menu not found.");
  }
}

export class MenuItemNotFoundError extends NavigationError {
  constructor() {
    super("item_not_found", "Menu item not found.");
  }
}

export class NoArchivedMenuError extends NavigationError {
  constructor() {
    super("no_archived_menu", "There is no previously-published menu for this location to roll back to.");
  }
}

/** linkType: Internal requires internalPath (and no externalUrl); External requires externalUrl (and no internalPath); None requires neither — a grouping node (mega-menu section heading, footer column heading) isn't itself clickable. */
export class InvalidLinkTargetError extends NavigationError {
  constructor() {
    super("invalid_link_target", "Set exactly one of an internal path or an external URL, matching the chosen link type.");
  }
}

/** Header items may nest 2 levels deep (top item → mega-menu section → link/promo tile); Footer 1 level (column → link); Mobile is flat. */
export class MaxDepthExceededError extends NavigationError {
  constructor() {
    super("max_depth_exceeded", "This menu location doesn't allow nesting an item this deep.");
  }
}

/** A Promo Tile content block only makes sense for Header's mega-menu children. */
export class InvalidContentBlockError extends NavigationError {
  constructor() {
    super("invalid_content_block", "A promo tile is only allowed on a Header mega-menu item.");
  }
}
