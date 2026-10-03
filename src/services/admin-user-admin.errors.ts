export type AdminUserAdminErrorCode = "not_found" | "email_in_use" | "invalid_invite_token" | "invite_token_expired";

export class AdminUserAdminError extends Error {
  constructor(
    message: string,
    public readonly code: AdminUserAdminErrorCode,
  ) {
    super(message);
    this.name = "AdminUserAdminError";
  }
}

export class AdminUserNotFoundError extends AdminUserAdminError {
  constructor() {
    super("Admin user not found.", "not_found");
  }
}

export class AdminEmailInUseError extends AdminUserAdminError {
  constructor() {
    super("An admin account with this email already exists.", "email_in_use");
  }
}

export class InvalidInviteTokenError extends AdminUserAdminError {
  constructor() {
    super("This invite link is invalid.", "invalid_invite_token");
  }
}

export class InviteTokenExpiredError extends AdminUserAdminError {
  constructor() {
    super("This invite link has expired. Ask a Super Administrator to resend it.", "invite_token_expired");
  }
}
