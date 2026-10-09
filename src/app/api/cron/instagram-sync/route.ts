import { timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { serverErrorResponse, unauthorizedResponse } from "@/lib/api/responses";
import { runScheduledSync } from "@/services/instagram.service";

/**
 * Hit by a systemd timer on the VPS (same pattern as the daily DB backup
 * job — no in-app cron/job-runner exists), not by an admin session. Auth
 * is a shared secret instead of adminAuth(), timing-safe compared so the
 * check itself can't leak the secret a byte at a time.
 */
function isAuthorized(request: Request): boolean {
  const configured = process.env.INSTAGRAM_SYNC_CRON_SECRET;
  if (!configured) return false;

  const header = request.headers.get("authorization");
  const provided = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!provided) return false;

  const expected = Buffer.from(configured);
  const actual = Buffer.from(provided);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) return unauthorizedResponse();

  try {
    await runScheduledSync();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return serverErrorResponse(error, "POST /api/cron/instagram-sync");
  }
}
