export type RoleAdminErrorCode = "not_found" | "key_in_use";

export class RoleAdminError extends Error {
  constructor(
    message: string,
    public readonly code: RoleAdminErrorCode,
  ) {
    super(message);
    this.name = "RoleAdminError";
  }
}

export class RoleNotFoundError extends RoleAdminError {
  constructor() {
    super("Role not found.", "not_found");
  }
}

export class RoleKeyInUseError extends RoleAdminError {
  constructor() {
    super("A role with this key already exists.", "key_in_use");
  }
}
