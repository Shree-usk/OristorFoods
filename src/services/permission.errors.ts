export type PermissionErrorCode = "permission_denied" | "super_administrator_floor" | "last_super_administrator";

export class PermissionServiceError extends Error {
  constructor(
    public readonly code: PermissionErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PermissionServiceError";
  }
}

/** The shared guard's rejection — every protected admin Service/route call throws this when the resolved role lacks the module+action grant. */
export class PermissionDeniedError extends PermissionServiceError {
  constructor() {
    super("permission_denied", "You do not have permission to perform this action.");
  }
}

/** The Super Administrator role's matrix can never be reduced below full access (AC). No caller exists yet (STORY-057 owns the role-editing UI) — this guard exists now so that story can call it. */
export class SuperAdministratorFloorError extends PermissionServiceError {
  constructor() {
    super("super_administrator_floor", "The Super Administrator role's permissions cannot be reduced.");
  }
}

/** Prevents deleting or de-elevating the last remaining Super Administrator account (AC). */
export class LastSuperAdministratorError extends PermissionServiceError {
  constructor() {
    super("last_super_administrator", "At least one Super Administrator account must remain.");
  }
}
