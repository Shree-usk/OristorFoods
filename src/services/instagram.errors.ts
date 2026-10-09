export type InstagramErrorCode = "instagram_not_connected" | "instagram_connect_failed" | "instagram_sync_failed";

export class InstagramError extends Error {
  constructor(
    public readonly code: InstagramErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "InstagramError";
  }
}

export class InstagramNotConnectedError extends InstagramError {
  constructor() {
    super("instagram_not_connected", "Instagram isn't connected yet. Paste an access token to connect it first.");
  }
}

/** message is the real reason surfaced by Meta's Graph API (or our own resolution logic) — shown as-is in the admin UI so a real misconfiguration (e.g. "no linked Instagram Business account") is diagnosable instead of a generic failure. */
export class InstagramConnectFailedError extends InstagramError {
  constructor(message: string) {
    super("instagram_connect_failed", message);
  }
}

export class InstagramSyncFailedError extends InstagramError {
  constructor(message: string) {
    super("instagram_sync_failed", message);
  }
}
